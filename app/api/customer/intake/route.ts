import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { IntakeService } from '@/lib/intake-service';
import { getCustomerIntakeReport, getPartialIntakeTranscript, savePartialIntakeTranscript, clearPartialIntakeTranscript } from '@/lib/db';
import type { User, IntakeTranscriptItem } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const transcriptItemSchema = z.object({
  question: z.string(),
  answer: z.string(),
  timestamp: z.string()
});

const intakeRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('initial'),
    caseId: z.string()
  }),
  z.object({
    action: z.literal('chat'),
    caseId: z.string(),
    message: z.string().min(1).max(2000),
    transcript: z.array(transcriptItemSchema).default([])
  }),
  z.object({
    action: z.literal('submit'),
    caseId: z.string(),
    transcript: z.array(transcriptItemSchema).min(1)
  })
]);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get('caseId');
    if (!caseId) {
      return Response.json({ error: 'Missing caseId' }, { status: 400 });
    }

    const existing = getCustomerIntakeReport(caseId);
    const partialTranscript = getPartialIntakeTranscript(caseId);
    
    return Response.json({
      isSubmitted: !!existing,
      submittedAt: existing?.timestamp || null,
      caseId,
      transcript: partialTranscript,
      openingQuestion: partialTranscript.length === 0 ? await IntakeService.getOpeningQuestion(caseId, 'Customer') : null
    });
  } catch {
    return Response.json({ error: 'Failed to check intake status' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    let user = await getCurrentUser();
    if (!user) {
      // Default demo customer authorization fallback
      user = {
        id: 'USR-CUST-1042',
        email: 'alex@example.com',
        name: 'Alex Morgan',
        role: 'CUSTOMER',
        accountId: 'HH-208'
      };
    }

    const body = intakeRequestSchema.parse(await req.json());

    // 1. Initial inquiry
    if (body.action === 'initial') {
      const existingReport = getCustomerIntakeReport(body.caseId);
      if (existingReport) {
        return Response.json({
          isSubmitted: true,
          submittedAt: existingReport.timestamp,
          openingQuestion: null,
          message: 'Response submitted',
          transcript: []
        });
      }

      const partialTranscript = getPartialIntakeTranscript(body.caseId);
      if (partialTranscript.length > 0) {
        return Response.json({
          isSubmitted: false,
          openingQuestion: null,
          status: 'in_progress',
          transcript: partialTranscript
        });
      }

      const openingQuestion = await IntakeService.getOpeningQuestion(body.caseId, user.name);
      return Response.json({
        isSubmitted: false,
        openingQuestion,
        status: 'in_progress',
        transcript: []
      });
    }

    // 2. Chat turn (adaptive follow-up questions)
    if (body.action === 'chat') {
      const chatResponse = await IntakeService.processChatTurn(
        body.caseId,
        body.message,
        body.transcript as IntakeTranscriptItem[]
      );

      // Save partial transcript
      savePartialIntakeTranscript(body.caseId, body.transcript as IntakeTranscriptItem[]);

      return Response.json(chatResponse);
    }

    // 3. Final submission
    if (body.action === 'submit') {
      const report = await IntakeService.submitIntakeReport(
        body.caseId,
        body.transcript as IntakeTranscriptItem[],
        user
      );

      clearPartialIntakeTranscript(body.caseId);

      // Customer-safe response: show clean confirmation without leaking internal admin metrics
      return Response.json({
        success: true,
        status: 'submitted',
        message: 'Response submitted',
        submittedAt: report.timestamp,
        caseId: body.caseId
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Intake route error:', err);
    const isValidation = err instanceof z.ZodError;
    return Response.json(
      { error: isValidation ? 'Invalid inquiry data' : 'Intake service processing failed', details: String(err) },
      { status: 400 }
    );
  }
}
