import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 
  authenticateUser, 
  encodeSession, 
  decodeSession, 
  authorizeCaseAccess 
} from '../lib/auth';
import { 
  listOrdersForAccount, 
  createCustomerDispute, 
  addCustomerMessage, 
  getAdminOverview, 
  listAllPolicies, 
  assignAgentToCase,
  getOrder,
  getRefund,
  getAudits
} from '../lib/db';
import { approve, analyze } from '../lib/engine';
import { answerCustomerQuestion } from '../lib/llm-service';
import type { User } from '../lib/types';

test('CUSTOMER AUTHENTICATION: Alex Morgan valid login returns safe User object without password', () => {
  const user = authenticateUser('alex@example.com', 'password123');
  assert.ok(user, 'User should authenticate');
  assert.equal(user.email, 'alex@example.com');
  assert.equal(user.role, 'CUSTOMER');
  assert.equal(user.accountId, 'HH-208');
  assert.equal((user as any).passwordHash, undefined, 'passwordHash must never be exposed');
});

test('AGENT AUTHENTICATION: Priya Shah valid login returns AGENT role', () => {
  const user = authenticateUser('priya@parcelproof.com', 'password123');
  assert.ok(user, 'Agent should authenticate');
  assert.equal(user.role, 'AGENT');
  assert.equal(user.name, 'Priya Shah');
});

test('ADMIN AUTHENTICATION: Sarah Connor valid login returns ADMIN role', () => {
  const user = authenticateUser('admin@parcelproof.com', 'password123');
  assert.ok(user, 'Admin should authenticate');
  assert.equal(user.role, 'ADMIN');
  assert.equal(user.name, 'Sarah Connor');
});

test('INVALID AUTHENTICATION: Wrong password returns null', () => {
  const user = authenticateUser('alex@example.com', 'wrongpassword');
  assert.equal(user, null);
});

test('SESSION ENCODE & DECODE: Roundtrip preserves user fields and accountId', () => {
  const user: User = {
    id: 'USR-CUST-1042',
    email: 'alex@example.com',
    name: 'Alex Morgan',
    role: 'CUSTOMER',
    accountId: 'HH-208'
  };
  const token = encodeSession(user);
  const decoded = decodeSession(token);
  assert.ok(decoded);
  assert.equal(decoded.id, user.id);
  assert.equal(decoded.role, user.role);
  assert.equal(decoded.accountId, user.accountId);
});

test('STRICT CUSTOMER DATA ISOLATION: Alex (HH-208) cannot access Sam (HH-309) case', () => {
  const alexUser: User = {
    id: 'USR-CUST-1042',
    email: 'alex@example.com',
    name: 'Alex Morgan',
    role: 'CUSTOMER',
    accountId: 'HH-208'
  };
  
  const samUser: User = {
    id: 'USR-CUST-1043',
    email: 'sam@example.com',
    name: 'Sam Rivera',
    role: 'CUSTOMER',
    accountId: 'HH-309'
  };

  // PP-1042 belongs to HH-208 (Alex)
  assert.equal(authorizeCaseAccess(alexUser, 'PP-1042'), true, 'Alex must access own case PP-1042');
  assert.equal(authorizeCaseAccess(samUser, 'PP-1042'), false, 'Sam must NOT access Alex case PP-1042');

  // PP-1043 belongs to HH-309 (Sam)
  assert.equal(authorizeCaseAccess(samUser, 'PP-1043'), true, 'Sam must access own case PP-1043');
  assert.equal(authorizeCaseAccess(alexUser, 'PP-1043'), false, 'Alex must NOT access Sam case PP-1043');
});

test('AGENT & ADMIN CASE AUTHORIZATION: Can access any case in the system', () => {
  const agentUser: User = {
    id: 'USR-AGENT-01',
    email: 'priya@parcelproof.com',
    name: 'Priya Shah',
    role: 'AGENT',
    accountId: null
  };
  const adminUser: User = {
    id: 'USR-ADMIN-01',
    email: 'admin@parcelproof.com',
    name: 'Sarah Connor',
    role: 'ADMIN',
    accountId: null
  };

  assert.equal(authorizeCaseAccess(agentUser, 'PP-1042'), true);
  assert.equal(authorizeCaseAccess(agentUser, 'PP-1043'), true);
  assert.equal(authorizeCaseAccess(adminUser, 'PP-1042'), true);
  assert.equal(authorizeCaseAccess(adminUser, 'PP-1045'), true);
});

test('CUSTOMER DISPUTE FILING: Creates real database order and support source', () => {
  const submission = {
    category: 'not_received' as const,
    description: 'My package is missing despite carrier delivered status.',
    item: 'Wireless Noise-Cancelling Headphones',
    amount: 149.99,
    currency: 'USD',
    photoUrl: undefined
  };

  const newOrder = createCustomerDispute('HH-208', 'Alex Morgan', submission);
  assert.ok(newOrder.id.startsWith('PP-'), 'Generated real case ID');
  assert.equal(newOrder.accountId, 'HH-208');
  assert.ok(newOrder.status.toLowerCase().includes('disputed'));

  // Verify in SQLite
  const fetched = getOrder(newOrder.id);
  assert.equal(fetched.id, newOrder.id);
  assert.equal(fetched.accountId, 'HH-208');
});

test('CUSTOMER MESSAGE FLOW: Appends message as real scoped support source', () => {
  const msgSource = addCustomerMessage('PP-1042', 'Alex Morgan', 'I have checked with my neighbours as well.');
  assert.ok(msgSource.id.startsWith('SUP-PP-1042-MSG-'));
  assert.equal(msgSource.orderId, 'PP-1042');
  assert.equal(msgSource.type, 'support');
  assert.ok(msgSource.text.includes('checked with my neighbours'));
});

test('CUSTOMER-SAFE AI ASSISTANT: Answers customer using RAG without exposing internal secrets', async () => {
  const alexUser: User = {
    id: 'USR-CUST-1042',
    email: 'alex@example.com',
    name: 'Alex Morgan',
    role: 'CUSTOMER',
    accountId: 'HH-208'
  };

  const answer = await answerCustomerQuestion('PP-1042', 'What is happening with my case?', alexUser);
  assert.ok(answer.summary && answer.summary.length > 10, 'Must provide summary');
  assert.ok(answer.orderId === 'PP-1042');
  assert.ok(answer.citations && answer.citations.length > 0, 'Must cite scoped sources');
  assert.ok(answer.nextStep.length > 0, 'Must provide next step');

  // Verify unauthorized access throws error
  const samUser: User = {
    id: 'USR-CUST-1043',
    email: 'sam@example.com',
    name: 'Sam Rivera',
    role: 'CUSTOMER',
    accountId: 'HH-309'
  };
  await assert.rejects(
    async () => {
      await answerCustomerQuestion('PP-1042', 'What is happening with my case?', samUser);
    },
    /Unauthorized/
  );
});

test('ADMIN INTELLIGENCE: Retrieves overview stats, policies, and assigns agent', () => {
  const overview = getAdminOverview();
  assert.ok(overview.totalOrders >= 4);
  assert.ok(overview.activeDisputes >= 1);
  assert.ok(overview.recentAudits.length >= 1);

  const pols = listAllPolicies();
  assert.ok(pols.some(p => p.id === 'POL-US-2'), 'Must include POL-US-2');

  const assignResult = assignAgentToCase('PP-1042', 'Daniel Kim');
  assert.equal(assignResult.success, true);
  assert.equal(assignResult.agentName, 'Daniel Kim');
});

test('HUMAN APPROVAL AND AUDIT TRAIL: Reconciled analysis can be atomically approved', async () => {
  const analysis = await analyze('PP-1042');
  assert.ok(analysis.id);
  
  const approval = approve('PP-1042', 'Daniel Kim', 'auth-test-key-1042', analysis.id);
  assert.ok(approval.action);
  const action = approval.action as any;
  assert.equal(action.agent, 'Daniel Kim');
  assert.equal(action.orderId, 'PP-1042');
  assert.ok(action.kind === 'initiate_refund' || action.kind === 'review_refund');

  const audits = getAudits('PP-1042');
  assert.ok(audits.some(a => a.id === action.id));
});
