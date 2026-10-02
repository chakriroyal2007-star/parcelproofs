import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { recordOwnerDecision } from '@/lib/db';
import type { OwnerDecisionType } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

const decisionSchema = z.object({
  decision: z.enum(['FULL_REFUND', 'REPLACEMENT', 'HOLD', 'ESCALATE']),
  reason: z.string().min(3),
  requiredEvidence: z.string().nullable().optional()
});

export async function POST(req: Request, ctx: Context) {
  try {
    const user = await getCurrentUser();
    if (user && user.role !== 'OWNER' && user.role !== 'ADMIN') {
      return Response.json({ error: 'Unauthorized: Operations owner role required' }, { status: 403 });
    }

    const id = (await ctx.params).id;
    const body = decisionSchema.parse(await req.json());
    const ownerName = user?.name || 'Elena Vance';

    const decision = recordOwnerDecision(
      id,
      body.decision as OwnerDecisionType,
      body.reason,
      body.requiredEvidence || null,
      ownerName
    );

    return Response.json({ success: true, decision });
  } catch (e) {
    const isZod = e instanceof z.ZodError;
    return Response.json(
      { error: isZod ? 'Invalid decision payload' : e instanceof Error ? e.message : 'Decision recording failed' },
      { status: 400 }
    );
  }
}
