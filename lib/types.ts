import { z } from 'zod';

export type Source = { 
  id: string; 
  accountId: string | null; 
  orderId: string | null; 
  type: string; 
  title: string; 
  timestamp: string; 
  text: string; 
  version: string | null; 
  effectiveFrom: string | null; 
  effectiveTo: string | null; 
  region: string | null; 
  photo: string | null 
};

export type DeliveryStatus = 
  | 'READY_FOR_ASSIGNMENT' 
  | 'ASSIGNED' 
  | 'PICKED_UP' 
  | 'OUT_FOR_DELIVERY' 
  | 'DELIVERY_ATTEMPTED' 
  | 'DELIVERED' 
  | 'FAILED' 
  | 'DISPUTED' 
  | 'DELIVERY_CONFIRMED';

export type DeliveryProof = {
  photoUrl: string | null;
  timestamp: string;
  note: string;
  location?: string | null;
  deliveryMethod?: string;
  verified?: boolean;
};

export type Product = {
  id: string;
  name: string;
  price: number;
  currency: string;
  category: string;
  description: string;
  image?: string;
  inStock: boolean;
};

export type Order = { 
  id: string; 
  accountId: string; 
  label: string; 
  item: string; 
  amount: number; 
  currency: string; 
  speaker: string; 
  recipient: string; 
  verified: boolean; 
  region: string; 
  deliveredAt: string | null; 
  status: string;
  // Extended lifecycle fields
  productId?: string;
  customerId?: string;
  deliveryAddress?: string;
  quantity?: number;
  deliveryStatus?: DeliveryStatus;
  deliveryAgentId?: string | null;
  deliveryAgentName?: string | null;
  deliveryProof?: DeliveryProof | null;
  assignedAt?: string | null;
  createdAt?: string;
};

export type Refund = { 
  orderId: string; 
  status: 'not_initiated' | 'initiated'; 
  actionId: string | null; 
  updatedAt: string 
};

export type Audit = { 
  id: string; 
  orderId: string; 
  agent: string; 
  kind: string; 
  at: string; 
  detail: string; 
  key: string 
};

const refs = z.array(z.string()).min(1);
export const statementSchema = z.object({ text: z.string(), sourceIds: refs });
export const extractionSchema = z.object({
  speakers: z.array(z.object({ name: z.string(), role: z.enum(['customer','agent','unknown']), sourceIds: refs })),
  claims: z.array(z.object({ text: z.string(), kind: z.enum(['reported','disputed','verified','unknown']), sourceIds: refs })),
  commitments: z.array(z.object({ quote: z.string(), speaker: z.string(), madeAt: z.string(), action: z.enum(['refund_initiation','other']), deadline: z.string().nullable(), intent: z.enum(['proposed','committed','unknown']), sourceIds: refs })),
  questions: z.array(statementSchema)
});
export const narrativeSchema = z.object({
  headline: statementSchema,
  conflicts: z.array(z.object({ title: z.string(), reported: statementSchema, disputed: statementSchema, resolution: statementSchema })),
  recommendation: z.object({ action: z.enum(['initiate_refund','review_refund','escalate']), title: z.string(), rationale: z.array(statementSchema), missing: z.array(z.string()), owner: z.string() }),
  reply: z.array(statementSchema),
  handoff: z.array(statementSchema)
});
export type Extraction = z.infer<typeof extractionSchema>;
export type Narrative = z.infer<typeof narrativeSchema>;
export type PromiseEntry = Extraction['commitments'][number] & { status: 'proposed'|'committed'|'fulfilled'|'overdue'|'unknown'; actionRecord: string | null };
export type Passage = { chunkId: string; source: Source; passage: string; method: string };
export type Gate = { action: 'initiate_refund'|'review_refund'|'escalate'; eligible: boolean; missing: string[]; policyId: string | null };
export type Analysis = { id: string; mode: 'fixture'|'live'; narrationOrigin: 'fixture'|'live_model'|'post_action_rules'; at: string; extraction: Extraction; narrative: Narrative; promises: PromiseEntry[]; evidence: Passage[]; accountContext: Source[]; gate: Gate; ledgerVersion: string; };
export type VerificationStatus = 'VERIFIED' | 'CLAIM' | 'CONFLICT' | 'UNVERIFIED' | 'MISSING';

export type MemoryItemType = 
  | 'fact'
  | 'customer_claim'
  | 'courier_claim'
  | 'commitment'
  | 'conflict'
  | 'missing_evidence'
  | 'policy_rule'
  | 'action_event'
  | 'timeline_event';

export type CaseMemoryItem = {
  id: string;
  type: MemoryItemType;
  content: string;
  sourceId: string;
  sourceType: string;
  timestamp: string;
  confidence: number;
  verificationStatus: VerificationStatus;
  metadata?: Record<string, unknown>;
};

export type CommitmentType = 'REFUND' | 'ESCALATION' | 'INVESTIGATION' | 'CALLBACK' | 'OTHER';
export type CommitmentStatus = 'PROMISED' | 'PENDING' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED' | 'CONFLICTED' | 'UNVERIFIED';

export type Commitment = {
  id: string;
  caseId: string;
  type: CommitmentType;
  statement: string;
  promisedBy: string;
  promisedAt: string;
  deadline: string | null;
  status: CommitmentStatus;
  sourceId: string;
  verified: boolean;
  actionRecord?: string | null;
};

export type RiskSignal = {
  id: string;
  level: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  sourceIds: string[];
};

export type CaseMemory = {
  caseId: string;
  customerId: string;
  orderId: string;
  intendedRecipient: string;
  currentSpeaker: string;
  speakerDistinction: 'CURRENT_SPEAKER' | 'OTHER_HOUSEHOLD_MEMBER' | 'ACCOUNT_LEVEL_RECORD' | 'UNKNOWN_ATTRIBUTION';
  verifiedFacts: CaseMemoryItem[];
  customerClaims: CaseMemoryItem[];
  courierClaims: CaseMemoryItem[];
  previousCommitments: Commitment[];
  refundStatus: 'not_initiated' | 'initiated';
  policyReferences: CaseMemoryItem[];
  unresolvedConflicts: CaseMemoryItem[];
  missingEvidence: CaseMemoryItem[];
  previousActions: CaseMemoryItem[];
  pendingActions: CaseMemoryItem[];
  importantTimelineEvents: CaseMemoryItem[];
  riskSignals: RiskSignal[];
  lastAnalyzedAt: string;
  lastUpdatedBy: string;
  confidence: number;
  sourceReferences: string[];
};

export type AIResponseStatus = 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'CONFLICTING' | 'INSUFFICIENT_EVIDENCE';

export type StructuredAIAnswer = {
  answer: string;
  status?: AIResponseStatus;
  confidence: number;
  verifiedFacts: string[];
  customerClaims: string[];
  courierClaims: string[];
  conflicts: string[];
  missingInformation: string[];
  previousCommitments: string[];
  recommendedNextStep: string;
  sources: string[];
};

export type AIChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sources?: string[];
  confidence?: number;
  structuredBreakdown?: StructuredAIAnswer;
};

export type NextAgentBrief = {
  caseId: string;
  customerIssue: string;
  verifiedInformation: string[];
  previousCommitment: string;
  unresolvedConflict: string;
  nextAction: string;
  generatedAt: string;
  agent: string;
  sourceIds: string[];
};

export type RefundAssessmentFactors = {
  customerEvidence: number;       // 0-20
  deliveryConsistency: number;    // 0-20
  courierConsistency: number;     // 0-15
  commitments: number;            // 0-15
  financialHistory: number;       // 0-10
  timelineConsistency: number;    // 0-10
  policyEligibility: number;      // 0-10
  total: number;                  // 0-100
  explanations: Record<string, string>;
};

export type RefundAssessment = {
  assessmentId: string;
  caseId: string;
  orderId: string;
  score: number; // 0-100
  level: 'INSUFFICIENT' | 'MIXED' | 'STRONG' | 'VERY_STRONG';
  levelLabel: string;
  factors: RefundAssessmentFactors;
  evidenceFor: string[];
  evidenceAgainst: string[];
  conflicts: string[];
  missingEvidence: string[];
  recommendation: string;
  uncertainty: string[];
  calculatedAt: string;
  version: string;
  sources: string[];
};

export type OwnerDecisionType = 'FULL_REFUND' | 'REPLACEMENT' | 'HOLD' | 'ESCALATE';

export type OwnerDecision = {
  decisionId: string;
  caseId: string;
  orderId: string;
  decision: OwnerDecisionType;
  reason: string;
  requiredEvidence?: string | null;
  ownerName: string;
  timestamp: string;
  scoreSnapshot: number;
  status: 'COMPLETED' | 'PENDING_INFO' | 'ESCALATED' | 'REJECTED';
};

export type TimelineEvent = {
  id: string;
  timestamp: string;
  stage: string;
  actor: string;
  actorRole: string;
  description: string;
  sourceId?: string | null;
  badgeType?: 'success' | 'warning' | 'neutral' | 'error';
  photoUrl?: string | null;
};

export type DeliveryAgent = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'Available' | 'On delivery' | 'Offline';
  activeDeliveries: number;
  completedDeliveries: number;
  disputedDeliveries: number;
};

export type CaseData = { 
  order: Order; 
  refund: Refund; 
  sources: Source[]; 
  accountContext: Source[]; 
  audits: Audit[]; 
  analysis: Analysis | null; 
  handoff: { agent: string; at: string; summary: z.infer<typeof statementSchema>[] } | null; 
  brief?: NextAgentBrief | null;
  memory?: CaseMemory | null;
  commitments?: Commitment[];
  riskSignals?: RiskSignal[];
  chatHistory?: AIChatMessage[];
  assessment?: RefundAssessment | null;
  ownerDecision?: OwnerDecision | null;
  timeline?: TimelineEvent[];
  intakeReport?: AdminIntakeReport | null;
  draft: string; 
  activeAgent: string; 
  mode: 'fixture'|'live'; 
  now: string;
};

export type UserRole = 'CUSTOMER' | 'OWNER' | 'DELIVERY_AGENT' | 'AGENT' | 'ADMIN';

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  accountId?: string | null;
  agentId?: string | null;
};

export type CustomerDisputeSubmission = {
  orderId: string;
  category: 'not_received' | 'wrong_location' | 'incorrect_photo' | 'damaged' | 'other';
  description: string;
  photoUrl?: string | null;
};

export type CustomerAIAnswer = {
  answer: string;
  summary?: string;
  status?: AIResponseStatus;
  orderId?: string;
  citations?: string[];
  caseStatus: string;
  refundStatus: string;
  nextStep: string;
  authorizedForCustomer: boolean;
  conflicts?: string[];
  missingInformation?: string[];
};

export type IntakeTranscriptItem = {
  question: string;
  answer: string;
  timestamp: string;
};

export type AdminIntakeReport = {
  reportId: string;
  caseId: string;
  orderItem: string;
  orderAmount: number;
  currency: string;
  customerName: string;
  accountId: string;
  timestamp: string;
  confidenceScore: number; // 0 - 100
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceBreakdown: {
    evidenceConsistency: number;
    courierConflictIndex: number;
    plausibilityScore: number;
  };
  executiveSummary: string;
  disputeCategory: string;
  extractedFacts: string[];
  detectedContradictions: string[];
  courierTelemetryEvaluation: string;
  recommendedAction: 'FULL_REFUND' | 'REPLACEMENT' | 'COURIER_INVESTIGATION' | 'IN_PERSON_INSPECTION' | 'DENIAL';
  actionRationale: string;
  questionsAskedCount: number;
  interviewTranscript: IntakeTranscriptItem[];
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'PROCESSED';
};

export type IntakeChatResponse = {
  reply: string;
  isInvestigationComplete: boolean;
  questionNumber: number;
  status: 'in_progress' | 'ready_to_submit';
};
