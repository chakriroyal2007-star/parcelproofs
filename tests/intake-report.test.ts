import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IntakeService } from '../lib/intake-service';
import { 
  saveCustomerIntakeReport, 
  getCustomerIntakeReport, 
  listAllCustomerIntakeReports,
  getOrder
} from '../lib/db';
import type { User, IntakeTranscriptItem } from '../lib/types';

test('DYNAMIC INTAKE: Opening questions vary based on case scenario', () => {
  const q1042 = IntakeService.getOpeningQuestion('PP-1042', 'Alex Morgan');
  const q1043 = IntakeService.getOpeningQuestion('PP-1043', 'Sam Rivera');

  assert.ok(q1042.includes('PP-1042'));
  assert.ok(q1042.includes('Alex'));
  // PP-1042 has wooden door photo scenario
  assert.ok(q1042.toLowerCase().includes('door') || q1042.toLowerCase().includes('photo'));

  assert.ok(q1043.includes('PP-1043'));
  assert.ok(q1043.includes('Sam'));
  // PP-1043 has mailroom delivery scenario
  assert.ok(q1043.toLowerCase().includes('mailroom') || q1043.toLowerCase().includes('locker'));

  // Opening questions for different scenarios are distinct
  assert.notEqual(q1042, q1043);
});

test('DYNAMIC INTAKE: Adaptive follow-up questions probe missing facts and adapt to answers', async () => {
  const history: IntakeTranscriptItem[] = [];

  // Turn 1: Customer clarifies the door in the photo is not theirs
  const turn1 = await IntakeService.processChatTurn(
    'PP-1042',
    'The door in the photo is dark wood, but my apartment door is white aluminum.',
    history
  );

  assert.ok(turn1.reply.length > 20);
  assert.equal(turn1.isInvestigationComplete, false);
  // Next probe checks camera/footage
  assert.ok(turn1.reply.toLowerCase().includes('camera') || turn1.reply.toLowerCase().includes('doorbell') || turn1.reply.toLowerCase().includes('footage'));

  history.push({
    question: 'Does the door match your residence?',
    answer: 'The door in the photo is dark wood, but my apartment door is white aluminum.',
    timestamp: new Date().toISOString()
  });

  // Turn 2: Customer answers about camera
  const turn2 = await IntakeService.processChatTurn(
    'PP-1042',
    'I checked my Ring doorbell camera and no delivery vehicle or courier was recorded at 14:15.',
    history
  );

  assert.ok(turn2.reply.length > 20);
  // Probes neighbors or indicates complete
  assert.ok(turn2.reply.toLowerCase().includes('neighbor') || turn2.reply.toLowerCase().includes('household') || turn2.isInvestigationComplete);
});

test('ADMIN REPORT & CONFIDENCE SCORE: Generates multi-factor confidence score and detailed report', async () => {
  const mockCustomer: User = {
    id: 'USR-CUST-1042',
    name: 'Alex Morgan',
    email: 'alex@example.com',
    role: 'CUSTOMER',
    accountId: 'HH-208'
  };

  const transcript: IntakeTranscriptItem[] = [
    {
      question: 'Does the entryway in the photo match your residence?',
      answer: 'The photo shows a wooden door with brass knocker, but my entrance is a white glass door.',
      timestamp: new Date().toISOString()
    },
    {
      question: 'Did your doorbell camera capture any delivery vehicle?',
      answer: 'My Ring camera recorded no motion or delivery drivers at all during that hour.',
      timestamp: new Date().toISOString()
    },
    {
      question: 'Have you checked with neighbors?',
      answer: 'I spoke with neighbor unit 209 and unit 207 and neither saw any packages left.',
      timestamp: new Date().toISOString()
    }
  ];

  const report = await IntakeService.submitIntakeReport('PP-1042', transcript, mockCustomer);

  assert.ok(report.reportId.startsWith('REP-PP-1042'));
  assert.equal(report.caseId, 'PP-1042');
  assert.equal(report.customerName, 'Alex Morgan');
  assert.equal(report.questionsAskedCount, 3);
  
  // High confidence score due to multiple consistent evidence points and photo contradiction
  assert.ok(report.confidenceScore >= 80, `Expected confidence >= 80, got ${report.confidenceScore}`);
  assert.equal(report.confidenceLevel, 'HIGH');
  assert.ok(report.confidenceBreakdown.evidenceConsistency >= 80);
  assert.ok(report.confidenceBreakdown.courierConflictIndex >= 80);

  // Recommendations and facts
  assert.ok(report.recommendedAction === 'FULL_REFUND' || report.recommendedAction === 'COURIER_INVESTIGATION');
  assert.ok(report.extractedFacts.length >= 2);
  assert.ok(report.detectedContradictions.length >= 1);
  assert.ok(report.executiveSummary.includes('Alex Morgan'));

  // Verify persistence in SQLite
  const savedReport = getCustomerIntakeReport('PP-1042');
  assert.ok(savedReport);
  assert.equal(savedReport.reportId, report.reportId);
  assert.equal(savedReport.confidenceScore, report.confidenceScore);

  // Verify appears in all reports list
  const allReports = listAllCustomerIntakeReports();
  assert.ok(allReports.some(r => r.reportId === report.reportId));
});
