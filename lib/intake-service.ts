import { randomUUID } from 'node:crypto';
import { 
  getOrder, 
  orderSources, 
  getRefund, 
  saveCustomerIntakeReport, 
  getCustomerIntakeReport, 
  listAllCustomerIntakeReports,
  mode,
  db
} from './db';
import { client, getModel } from './retrieval';
import type { 
  Order, 
  User, 
  AdminIntakeReport, 
  IntakeTranscriptItem, 
  IntakeChatResponse 
} from './types';

/**
 * Intelligent Dynamic Dispute Intake Service
 * Conducts scenario-grounded interviews with varying, non-fixed questions
 * and compiles comprehensive Admin Reports with calculated confidence scores.
 */
export class IntakeService {

  /**
   * Generates a context-tailored opening inquiry based on the exact case scenario.
   */
  static async getOpeningQuestion(caseId: string, customerName: string): Promise<string> {
    const order = getOrder(caseId);
    const sources = orderSources(order);
    const courierSrc = sources.find(s => s.type === 'courier');
    const courierText = courierSrc?.text || order.deliveryProof?.note || 'Package marked delivered';

    const greeting = customerName ? `Hello ${customerName.split(' ')[0]}` : 'Hello';
    const liveModel = getModel();

    try {
      const retrievedPassages = await client().chat.completions.create({
        model: liveModel,
        messages: [
          {
            role: 'system',
            content: `You are ParcelProof's AI Dispute Investigator. Order: ${caseId} (${order.item}). Courier Note: ${courierText}. Generate a brief, natural opening greeting and ONE initial investigation question based on the delivery notes to begin the refund investigation.`
          }
        ]
      });
      const reply = retrievedPassages.choices[0]?.message?.content?.trim();
      if (reply) return reply;
    } catch (e) {
      console.warn('Failed to generate opening question', e);
    }
    return `${greeting}! I am your ParcelProof AI Dispute Investigator for order ${caseId}. Could you describe where you looked for the parcel and what condition your drop-off area was in?`;
  }

  /**
   * Processes a conversational turn from the customer, dynamically generating
   * the next adaptive question based on what has already been said.
   */
  static async processChatTurn(
    caseId: string,
    customerAnswer: string,
    history: IntakeTranscriptItem[]
  ): Promise<IntakeChatResponse> {
    const order = getOrder(caseId);
    const sources = orderSources(order);
    const courierSrc = sources.find(s => s.type === 'courier');
    const courierText = courierSrc?.text || '';
    const turnCount = history.length + 1; // 1-indexed

    const liveModel = getModel();
    try {
      const retrievedPassages = await retrieve(order, customerAnswer);
      const ragContext = retrievedPassages.map(p => `[${p.source.id}] ${p.passage}`).join('\n\n');

      const completion = await client().chat.completions.create({
        model: liveModel,
        messages: [
          {
            role: 'system',
            content: `You are ParcelProof's Adaptive Dispute Investigator interviewing a customer regarding their delivery dispute for order ${caseId} (${order.item}, ${order.currency} ${order.amount}).
Guidelines:
1. Empathize but deeply evaluate their statements against the delivery agent's notes, proof, and RAG evidence.
2. Ask ONE focused, natural follow-up question probing for missing physical evidence, visual discrepancies, security camera footage, or neighbor verification.
3. You MUST ask at least 5-8 questions in total across the conversation. Do not repeat topics already discussed.
4. ONLY if they have provided sufficient substantive details across 5-8 turns, inform them that you have gathered sufficient evidence and invite them to submit their responses by outputting EXACTLY "INVESTIGATION_COMPLETE: [Your closing message here]".
Keep your response professional and conversational (2-3 sentences max).`
          },
          {
            role: 'user',
            content: `Case Context:
Item: ${order.item} (${order.currency} ${order.amount})
Status: ${order.status}
Courier Notes & Proof: ${courierText} (Photo: ${courierSrc?.photo || order.deliveryProof?.photoUrl ? 'Provided' : 'None'})

RAG Evidence / Case Documents:
${ragContext}

Interview History so far (${history.length} turns):
${history.map((h, i) => `Q${i + 1}: ${h.question}\nA${i + 1}: ${h.answer}`).join('\n\n')}

Customer's Latest Answer: "${customerAnswer}"

Respond with the next question, or if 5-8 turns are met and it's complete, prefix with INVESTIGATION_COMPLETE:.`
          }
        ]
      });

      let reply = completion.choices[0]?.message?.content?.trim() || '';
      const isComplete = reply.startsWith('INVESTIGATION_COMPLETE:');
      if (isComplete) {
        reply = reply.replace('INVESTIGATION_COMPLETE:', '').trim();
      }

      return {
        reply,
        isInvestigationComplete: isComplete,
        questionNumber: turnCount + 1,
        status: isComplete ? 'ready_to_submit' : 'in_progress'
      };
    } catch (err) {
      console.warn('Live LLM intake error:', err);
      return {
        reply: "I apologize, but I'm having trouble connecting right now. Please wait a moment.",
        isInvestigationComplete: false,
        questionNumber: turnCount + 1,
        status: 'in_progress'
      };
    }
  }

  /**
   * Finalizes the interview, calculates the multi-factor confidence score,
   * generates the detailed Admin Report, and persists it in SQLite.
   */
  static async submitIntakeReport(
    caseId: string,
    transcript: IntakeTranscriptItem[],
    customer: User
  ): Promise<AdminIntakeReport> {
    const order = getOrder(caseId);
    const sources = orderSources(order);
    const courierSrc = sources.find(s => s.type === 'courier');
    const courierText = courierSrc?.text || order.deliveryProof?.note || 'Delivered';
    const photoUrl = courierSrc?.photo || order.deliveryProof?.photoUrl;
    const nowIso = new Date().toISOString();

    const liveModel = getModel();
    const retrievedPassages = await retrieve(order, 'refund investigation evidence policies delivery');
    const ragContext = retrievedPassages.map(p => `[${p.source.id}] ${p.passage}`).join('\n\n');
    const transcriptText = transcript.map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer}`).join('\n\n');

    let extractedFacts: string[] = [];
    let detectedContradictions: string[] = [];
    let courierTelemetryEvaluation = 'No photographic drop-off proof was attached to carrier telemetry.';
    let evidenceConsistency = 70;
    let courierConflictIndex = 70;
    let plausibilityScore = 70;
    let executiveSummary = '';
    let recommendedAction: AdminIntakeReport['recommendedAction'] = 'COURIER_INVESTIGATION';
    let actionRationale = '';

    try {
      const completion = await client().chat.completions.create({
        model: liveModel,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are ParcelProof's AI Dispute Investigator. You have completed an investigation for order ${caseId}. Analyze the transcript, order details, and RAG context to generate a comprehensive investigation score and report.
Output JSON format:
{
  "extractedFacts": ["Fact 1", "Fact 2"],
  "detectedContradictions": ["Contradiction 1 (if any)"],
  "courierTelemetryEvaluation": "Evaluation of the delivery agent's proof",
  "evidenceConsistency": 85, // out of 100
  "courierConflictIndex": 90, // out of 100, higher means more evidence against courier
  "plausibilityScore": 80, // out of 100
  "executiveSummary": "A 2-3 sentence summary of the investigation",
  "recommendedAction": "FULL_REFUND" | "COURIER_INVESTIGATION" | "IN_PERSON_INSPECTION",
  "actionRationale": "Why this action is recommended"
}`
          },
          {
            role: 'user',
            content: `Order: ${order.item} (${order.currency} ${order.amount})
Status: ${order.status}
Courier Notes: ${courierText} (Photo: ${photoUrl ? 'Provided' : 'None'})

RAG Context:
${ragContext}

Interview Transcript:
${transcriptText}`
          }
        ]
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(responseText);

      extractedFacts = parsed.extractedFacts || [];
      detectedContradictions = parsed.detectedContradictions || [];
      courierTelemetryEvaluation = parsed.courierTelemetryEvaluation || courierTelemetryEvaluation;
      evidenceConsistency = Number(parsed.evidenceConsistency) || 70;
      courierConflictIndex = Number(parsed.courierConflictIndex) || 70;
      plausibilityScore = Number(parsed.plausibilityScore) || 70;
      executiveSummary = parsed.executiveSummary || 'AI Investigation completed.';
      recommendedAction = ['FULL_REFUND', 'COURIER_INVESTIGATION', 'IN_PERSON_INSPECTION'].includes(parsed.recommendedAction) ? parsed.recommendedAction : 'COURIER_INVESTIGATION';
      actionRationale = parsed.actionRationale || 'Evidence requires human review.';
    } catch (err) {
      console.warn('Failed to generate LLM report, using fallback values.', err);
      extractedFacts = ['Customer reported non-receipt.'];
      executiveSummary = `Customer ${customer.name || order.recipient} completed an AI investigative interview. Evidence requires manual review.`;
    }

    const rawScore = Math.round(
      evidenceConsistency * 0.35 + 
      courierConflictIndex * 0.40 + 
      plausibilityScore * 0.25
    );
    const confidenceScore = Math.min(100, Math.max(0, rawScore));
    const confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 
      confidenceScore >= 80 ? 'HIGH' : (confidenceScore >= 65 ? 'MEDIUM' : 'LOW');

    const report: AdminIntakeReport = {
      reportId: `REP-${caseId}-${Date.now()}`,
      caseId,
      orderItem: order.item,
      orderAmount: order.amount,
      currency: order.currency,
      customerName: customer.name || order.recipient,
      accountId: customer.accountId || order.accountId,
      timestamp: nowIso,
      confidenceScore,
      confidenceLevel,
      confidenceBreakdown: {
        evidenceConsistency,
        courierConflictIndex,
        plausibilityScore
      },
      executiveSummary,
      disputeCategory: order.deliveryProof?.note ? 'Misdelivery / Photo Mismatch' : 'Non-Receipt / Telemetry Conflict',
      extractedFacts,
      detectedContradictions,
      courierTelemetryEvaluation,
      recommendedAction,
      actionRationale,
      questionsAskedCount: transcript.length,
      interviewTranscript: transcript,
      status: 'SUBMITTED'
    };

    // Save to SQLite
    saveCustomerIntakeReport(report);

    // Record an audit log for operations
    try {
      db().prepare(`
        INSERT OR IGNORE INTO audits(id, orderId, agent, kind, at, detail, key)
        VALUES(?, ?, ?, ?, ?, ?, ?)
      `).run(
        `AUDIT-INTAKE-${Date.now()}`,
        caseId,
        'ParcelProof AI Intake Assistant',
        'customer_intake_submitted',
        nowIso,
        `AI Investigation completed for ${caseId}. Confidence: ${confidenceScore}%. Recommendation: ${recommendedAction}.`,
        `intake-${caseId}-${Date.now()}`
      );
    } catch {}

    return report;
  }
}
