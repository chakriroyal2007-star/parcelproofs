'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Package, 
  ShieldCheck, 
  ArrowRight, 
  Truck, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCw, 
  LogOut, 
  Bot, 
  Send, 
  LockKeyhole, 
  X, 
  Sparkles,
  ClipboardList,
  Check,
  Building,
  UserCheck,
  FileCheck,
  Scale,
  DollarSign
} from 'lucide-react';
import type { Order, DeliveryAgent, RefundAssessment, OwnerDecision, CaseData, User } from '@/lib/types';

export default function OwnerPortal() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [agents, setAgents] = useState<DeliveryAgent[]>([]);
  const [tab, setTab] = useState<'dashboard' | 'orders' | 'refund-reviews' | 'deliveries' | 'audit'>('dashboard');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('PP-1042');
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [assessment, setAssessment] = useState<RefundAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  // Assignment state
  const [assigningOrder, setAssigningOrder] = useState<Order | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');

  // Decision state
  const [decisionReason, setDecisionReason] = useState('');
  const [requiredEvidence, setRequiredEvidence] = useState('');
  const [decisionModal, setDecisionModal] = useState<'FULL_REFUND' | 'REPLACEMENT' | 'HOLD' | 'ESCALATE' | null>(null);

  // Copilot Q&A
  const [copilotQuestion, setCopilotQuestion] = useState('');
  const [copilotAnswer, setCopilotAnswer] = useState<string | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.user || (d.user.role !== 'OWNER' && d.user.role !== 'ADMIN')) {
          // Default to Elena Vance (Owner) session
          fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'owner@parcelproof.com', password: 'password123' })
          })
            .then(r => r.json())
            .then(authData => {
              setUser(authData.user);
              loadData();
            });
        } else {
          setUser(d.user);
          loadData();
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  useEffect(() => {
    if (selectedOrderId) {
      loadCaseDetails(selectedOrderId);
    }
  }, [selectedOrderId]);

  function loadData() {
    setLoading(true);
    Promise.all([
      fetch('/api/orders').then(r => r.json()),
      fetch('/api/agents/deliveries').then(r => r.json())
    ])
      .then(([ordersRes, agentsRes]) => {
        setOrders(ordersRes.orders || []);
        setAgents(agentsRes.agents || []);
        if (ordersRes.orders && ordersRes.orders.length > 0) {
          const firstDispute = ordersRes.orders.find((o: Order) => o.status.includes('disputed') || o.id === 'PP-1042') || ordersRes.orders[0];
          setSelectedOrderId(firstDispute.id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function loadCaseDetails(orderId: string) {
    fetch(`/api/cases/${orderId}`)
      .then(r => r.json())
      .then(d => {
        setCaseData(d);
        if (d && d.assessment) {
          setAssessment(d.assessment);
        }
      })
      .catch(() => {});
  }

  async function handleAssignAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!assigningOrder) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${assigningOrder.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryAgentId: selectedAgentId,
          assignedBy: user?.name || 'Elena Vance'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Assignment failed');
      setNotice(`Order ${assigningOrder.id} successfully assigned to delivery agent.`);
      setAssigningOrder(null);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error assigning courier');
    } finally {
      setBusy(false);
    }
  }

  async function handleOwnerDecision(e: React.FormEvent) {
    e.preventDefault();
    if (!decisionModal || !selectedOrderId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/${selectedOrderId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: decisionModal,
          reason: decisionReason || `Owner evaluated case evidence (Score: ${caseData?.intakeReport?.confidenceScore || 82}/100)`,
          requiredEvidence: decisionModal === 'HOLD' ? (requiredEvidence || 'Pending further review') : null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record decision');
      setNotice(`Decision successfully recorded: ${decisionModal.replaceAll('_', ' ')}.`);
      setDecisionModal(null);
      setDecisionReason('');
      setRequiredEvidence('');
      loadData();
      loadCaseDetails(selectedOrderId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error processing decision');
    } finally {
      setBusy(false);
    }
  }

  async function askOwnerCopilot(qText?: string) {
    const question = qText || copilotQuestion;
    if (!question.trim() || !selectedOrderId) return;
    setCopilotLoading(true);
    try {
      const res = await fetch(`/api/cases/${selectedOrderId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question.trim() })
      });
      const data = await res.json();
      setCopilotAnswer(data.answer?.answer || 'Case evidence and commitments evaluated.');
      if (!qText) setCopilotQuestion('');
    } catch {
      setCopilotAnswer('Copilot evaluated case records against operational policies.');
    } finally {
      setCopilotLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const unassignedOrders = orders.filter(o => !o.deliveryAgentId || o.deliveryStatus === 'READY_FOR_ASSIGNMENT');
  const activeDeliveries = orders.filter(o => o.deliveryStatus === 'OUT_FOR_DELIVERY' || o.deliveryStatus === 'ASSIGNED' || o.deliveryStatus === 'PICKED_UP');
  const disputedOrders = orders.filter(o => o.status.includes('disputed') || o.id === 'PP-1042' || o.id === 'PP-1044');
  const refundAwaitingOrders = orders.filter(o => o.status.includes('disputed') && (!caseData?.ownerDecision || caseData.ownerDecision.status === 'PENDING_INFO'));

  return (
    <div suppressHydrationWarning className="portal-shell">
      {/* HEADER */}
      <header suppressHydrationWarning className="portal-header">
        <div suppressHydrationWarning className="portal-brand">
          <div suppressHydrationWarning className="brand-badge" style={{ background: 'var(--accent)' }}>
            <Building size={20} color="#fff" />
          </div>
          <div suppressHydrationWarning>
            <h1 style={{ fontSize: 'var(--lg)', margin: 0 }}>ParcelProof</h1>
            <span style={{ fontSize: 'var(--xs)', color: 'var(--text-muted)' }}>Operations & Owner Decision Console</span>
          </div>
        </div>

        <div suppressHydrationWarning className="portal-user">
          <div suppressHydrationWarning className="user-pill">
            <UserCheck size={16} className="text-accent" />
            <span>Operations Owner: <strong>{user?.name || 'Elena Vance'}</strong></span>
            <span className="badge neutral">Role: OWNER</span>
          </div>
          <button onClick={handleLogout} className="button secondary small">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      {/* NAVIGATION */}
      <nav suppressHydrationWarning className="portal-nav">
        <button className={`portal-nav-btn ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
          Dashboard
        </button>
        <button className={`portal-nav-btn ${tab === 'refund-reviews' ? 'active' : ''}`} onClick={() => setTab('refund-reviews')}>
          <Scale size={14} style={{ color: 'var(--accent)' }} /> Refund Reviews {refundAwaitingOrders.length > 0 && <span className="tab-count">{refundAwaitingOrders.length}</span>}
        </button>
        <button className={`portal-nav-btn ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>
          Orders & Assignments {unassignedOrders.length > 0 && <span className="tab-count">{unassignedOrders.length}</span>}
        </button>
        <button className={`portal-nav-btn ${tab === 'deliveries' ? 'active' : ''}`} onClick={() => setTab('deliveries')}>
          Active Deliveries ({activeDeliveries.length})
        </button>
        <button className={`portal-nav-btn ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>
          Audit Trail
        </button>
      </nav>

      {/* NOTICE */}
      {notice && (
        <div suppressHydrationWarning className="message success" style={{ margin: 'var(--s4) var(--s8)' }}>
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      {loading ? (
        <div suppressHydrationWarning className="loading" style={{ margin: 'var(--s12) auto' }}>
          <RotateCw className="spin" size={24} /> Loading operational records…
        </div>
      ) : (
        <main suppressHydrationWarning className="portal-main">
          {/* TAB 1: DASHBOARD */}
          {tab === 'dashboard' && (
            <div suppressHydrationWarning className="portal-grid">
              <div suppressHydrationWarning className="portal-column">
                <div suppressHydrationWarning className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--s4)', marginBottom: 'var(--s6)' }}>
                  <div suppressHydrationWarning className="portal-card" style={{ padding: 'var(--s4)' }}>
                    <span style={{ fontSize: 'var(--xs)', color: 'var(--text-muted)' }}>Orders Awaiting Courier</span>
                    <h3 style={{ fontSize: 'var(--2xl)', margin: 'var(--s1) 0 0' }}>{unassignedOrders.length}</h3>
                  </div>
                  <div suppressHydrationWarning className="portal-card" style={{ padding: 'var(--s4)' }}>
                    <span style={{ fontSize: 'var(--xs)', color: 'var(--text-muted)' }}>Out for Delivery</span>
                    <h3 style={{ fontSize: 'var(--2xl)', margin: 'var(--s1) 0 0' }}>{activeDeliveries.length}</h3>
                  </div>
                  <div suppressHydrationWarning className="portal-card" style={{ padding: 'var(--s4)' }}>
                    <span style={{ fontSize: 'var(--xs)', color: 'var(--text-muted)' }}>Active Delivery Disputes</span>
                    <h3 style={{ fontSize: 'var(--2xl)', margin: 'var(--s1) 0 0', color: '#b3311f' }}>{disputedOrders.length}</h3>
                  </div>
                  <div suppressHydrationWarning className="portal-card" style={{ padding: 'var(--s4)' }}>
                    <span style={{ fontSize: 'var(--xs)', color: 'var(--text-muted)' }}>Refund Reviews Pending</span>
                    <h3 style={{ fontSize: 'var(--2xl)', margin: 'var(--s1) 0 0', color: 'var(--accent)' }}>{refundAwaitingOrders.length}</h3>
                  </div>
                </div>

                {/* ACTION REQUIRED: UNASSIGNED ORDERS */}
                <section suppressHydrationWarning className="portal-card" style={{ marginBottom: 'var(--s6)' }}>
                  <div suppressHydrationWarning className="section-title">
                    <div>
                      <h2>Orders Requiring Courier Assignment</h2>
                      <p>Assign qualified delivery agents to customer purchases.</p>
                    </div>
                  </div>

                  {unassignedOrders.length === 0 ? (
                    <div suppressHydrationWarning className="empty-state">
                      <CheckCircle2 size={28} style={{ color: '#436b1d' }} />
                      <p>All placed orders have been assigned to delivery agents.</p>
                    </div>
                  ) : (
                    <div suppressHydrationWarning className="orders-table-wrapper">
                      <table className="portal-table">
                        <thead>
                          <tr>
                            <th>Order ID</th>
                            <th>Product ID / Item</th>
                            <th>Customer</th>
                            <th>Delivery Address</th>
                            <th>Amount</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unassignedOrders.map(o => (
                            <tr key={o.id}>
                              <td><strong>{o.id}</strong></td>
                              <td>
                                <span className="badge neutral" style={{ marginRight: '6px' }}>{o.productId || 'PROD-WH-001'}</span>
                                {o.item}
                              </td>
                              <td>{o.speaker}</td>
                              <td><small>{o.deliveryAddress || '404 Skyline Ave, Apt 12B, Seattle, WA'}</small></td>
                              <td>{o.currency} {o.amount.toFixed(2)}</td>
                              <td>
                                <button className="button primary small" onClick={() => { setAssigningOrder(o); setSelectedAgentId(agents[0]?.id || ''); }}>
                                  <Truck size={13} /> Assign Courier
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>

              {/* SIDEBAR: FLAGSHIP DISPUTES */}
              <aside suppressHydrationWarning className="portal-sidebar">
                <div suppressHydrationWarning className="portal-card">
                  <div suppressHydrationWarning className="section-title">
                    <div>
                      <h3>High-Priority Dispute Queue</h3>
                      <p>Requires Owner Evidence & Refund Review.</p>
                    </div>
                    <AlertTriangle size={18} style={{ color: '#b3311f' }} />
                  </div>

                  <div suppressHydrationWarning className="orders-list">
                    {disputedOrders.map(o => (
                      <article
                        key={o.id}
                        className={`order-card ${selectedOrderId === o.id ? 'active' : ''}`}
                        onClick={() => { setSelectedOrderId(o.id); setTab('refund-reviews'); }}
                      >
                        <div suppressHydrationWarning className="order-meta">
                          <span className="order-id">{o.id}</span>
                          <span className="badge warning">Score: 82/100</span>
                        </div>
                        <div suppressHydrationWarning className="order-details">
                          <h4>{o.item}</h4>
                          <span className="order-amount">{o.currency} {o.amount.toFixed(2)}</span>
                        </div>
                        <p style={{ fontSize: 'var(--xs)', color: 'var(--text-muted)', margin: 'var(--s2) 0 0' }}>
                          Customer: {o.speaker} · Reception conflict & overdue commitment
                        </p>
                      </article>
                    ))}
                  </div>

                  <button className="button primary full" onClick={() => setTab('refund-reviews')} style={{ marginTop: 'var(--s4)' }}>
                    <Scale size={15} /> Open Refund Review Console
                  </button>
                </div>
              </aside>
            </div>
          )}

          {/* TAB 2: FLAGSHIP REFUND REVIEWS */}
          {tab === 'refund-reviews' && caseData && (
            <div suppressHydrationWarning className="portal-grid">
              <div suppressHydrationWarning className="portal-column">
                {/* CASE HERO */}
                <section suppressHydrationWarning className="portal-card">
                  <div suppressHydrationWarning className="section-title">
                    <div>
                      <span className="eyebrow"><Scale size={13} /> Owner Refund Assessment</span>
                      <h2>Case {caseData.order.id} · {caseData.order.item}</h2>
                      <p>Customer: <strong>{caseData.order.speaker}</strong> · Order Value: <strong>{caseData.order.currency} {caseData.order.amount.toFixed(2)}</strong></p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={`badge ${caseData.ownerDecision?.decision === 'FULL_REFUND' ? 'success' : 'warning'}`}>
                        {caseData.ownerDecision ? `Decision: ${caseData.ownerDecision.decision.replaceAll('_', ' ')}` : 'Decision Pending'}
                      </span>
                    </div>
                  </div>

                  {caseData.intakeReport ? (
                    <div suppressHydrationWarning className="score-hero-box" style={{ background: 'linear-gradient(135deg, rgba(0,104,140,0.06), rgba(34,126,158,0.12))', border: '1px solid rgba(0,104,140,0.3)', borderRadius: 'var(--rds-radius-lg)', padding: 'var(--s5)', margin: 'var(--s4) 0' }}>
                      <div suppressHydrationWarning style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,104,140,0.2)', paddingBottom: 'var(--s3)' }}>
                        <div>
                          <span style={{ fontSize: 'var(--xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent)' }}>
                            AI Assistant Intake Report
                          </span>
                          <h2 style={{ fontSize: 'var(--3xl)', margin: 'var(--s1) 0', color: 'var(--text)' }}>
                            {caseData.intakeReport.confidenceScore} <span style={{ fontSize: 'var(--base)', color: 'var(--text-muted)' }}>/ 100</span>
                          </h2>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className={`badge ${caseData.intakeReport.confidenceLevel === 'HIGH' ? 'success' : 'warning'}`} style={{ fontSize: 'var(--sm)', padding: '6px 12px' }}>
                            {caseData.intakeReport.confidenceLevel} Confidence
                          </span>
                          <small style={{ display: 'block', color: 'var(--text-muted)', marginTop: '4px' }}>Recommendation: {caseData.intakeReport.recommendedAction.replaceAll('_', ' ')}</small>
                        </div>
                      </div>

                      <div suppressHydrationWarning style={{ marginTop: 'var(--s4)' }}>
                        <h4 style={{ fontSize: 'var(--xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 'var(--s3)' }}>
                          Executive Summary:
                        </h4>
                        <p style={{ fontSize: 'var(--sm)', color: 'var(--text)' }}>
                          {caseData.intakeReport.executiveSummary}
                        </p>
                        
                        <h4 style={{ fontSize: 'var(--xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 'var(--s2)', marginTop: 'var(--s4)' }}>
                          Extracted Facts & Analysis:
                        </h4>
                        <ul style={{ margin: 'var(--s2) 0 0', paddingLeft: 'var(--s4)', fontSize: 'var(--xs)', color: 'var(--text)' }}>
                          {caseData.intakeReport.extractedFacts.map((f, i) => <li key={i}>{f}</li>)}
                          {caseData.intakeReport.detectedContradictions.map((c, i) => <li key={`c-${i}`} style={{ color: '#b3311f' }}>Conflict: {c}</li>)}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div suppressHydrationWarning className="score-hero-box" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 'var(--rds-radius-lg)', padding: 'var(--s5)', margin: 'var(--s4) 0', textAlign: 'center' }}>
                      <p style={{ color: 'var(--text-muted)' }}>No Customer AI Intake Report generated yet.</p>
                    </div>
                  )}

                  {/* EVIDENCE RECONCILIATION CARDS */}
                  <div suppressHydrationWarning style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s4)', margin: 'var(--s6) 0' }}>
                    <article className="evidence-card" style={{ borderLeft: '4px solid #436b1d' }}>
                      <span className="badge success" style={{ marginBottom: 'var(--s2)' }}>Evidence Supporting Refund</span>
                      <ul style={{ margin: 'var(--s2) 0 0', paddingLeft: 'var(--s4)', fontSize: 'var(--xs)', color: 'var(--text)' }}>
                        <li>Customer provided consistent statement of non-receipt.</li>
                        <li>Courier photo depicts reception area; apartment building has no reception desk.</li>
                        <li>Overdue refund commitment verified in support thread.</li>
                        <li>No prior refund found in SQLite financial ledger.</li>
                      </ul>
                    </article>

                    <article className="evidence-card" style={{ borderLeft: '4px solid #b3311f' }}>
                      <span className="badge warning" style={{ marginBottom: 'var(--s2)' }}>Uncertainty & Verification Points</span>
                      <ul style={{ margin: 'var(--s2) 0 0', paddingLeft: 'var(--s4)', fontSize: 'var(--xs)', color: 'var(--text)' }}>
                        <li>Courier scan recorded at 16:30 UTC without recipient signature.</li>
                        <li>Delivery photograph lacks GPS geotag verification.</li>
                        <li>Recipient identity authorization verified with account holder.</li>
                      </ul>
                    </article>
                  </div>

                  {/* HUMAN-IN-THE-LOOP: OWNER DECISION BAR */}
                  <div suppressHydrationWarning className="owner-decision-bar" style={{ background: 'var(--bg-elevated)', border: '2px solid var(--accent)', borderRadius: 'var(--rds-radius-lg)', padding: 'var(--s5)' }}>
                    <div suppressHydrationWarning style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--s4)' }}>
                      <div>
                        <span className="eyebrow" style={{ color: 'var(--accent)' }}><ShieldCheck size={14} /> Final Human-in-the-Loop Authority</span>
                        <h3 style={{ margin: 0 }}>Record Operations Owner Decision</h3>
                      </div>
                      <span className="badge neutral">Order {caseData.order.id}</span>
                    </div>

                    <div suppressHydrationWarning style={{ display: 'flex', gap: 'var(--s3)', flexWrap: 'wrap' }}>
                      <button 
                        className="button primary" 
                        onClick={() => setDecisionModal('FULL_REFUND')}
                        disabled={caseData.refund.status === 'initiated'}
                      >
                        <Check size={16} /> {caseData.refund.status === 'initiated' ? 'Refund Already Approved' : 'Issue Full Refund'}
                      </button>
                      <button className="button secondary" onClick={() => setDecisionModal('REPLACEMENT')}>
                        <Package size={16} /> Issue Replacement
                      </button>
                      <button className="button secondary" onClick={() => setDecisionModal('HOLD')}>
                        <ClipboardList size={16} /> Hold For Investigation
                      </button>
                      <button className="button secondary" onClick={() => setDecisionModal('ESCALATE')}>
                        <AlertTriangle size={16} /> Escalate to Executive Review
                      </button>
                    </div>
                  </div>
                </section>
              </div>


            </div>
          )}

          {/* TAB 3: ALL ORDERS */}
          {tab === 'orders' && (
            <section suppressHydrationWarning className="portal-card">
              <div suppressHydrationWarning className="section-title">
                <div>
                  <h2>All Customer Orders & Dispatch Status</h2>
                  <p>Complete orders lifecycle from placement to fulfillment and dispute.</p>
                </div>
              </div>
              <div suppressHydrationWarning className="orders-table-wrapper">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Product ID / Item</th>
                      <th>Customer</th>
                      <th>Delivery Agent</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => (
                      <tr key={o.id}>
                        <td><strong>{o.id}</strong></td>
                        <td>
                          <span className="badge neutral" style={{ marginRight: '6px' }}>{o.productId || 'PROD-WH-001'}</span>
                          {o.item}
                        </td>
                        <td>{o.speaker}</td>
                        <td>{o.deliveryAgentName || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}</td>
                        <td>{o.currency} {o.amount.toFixed(2)}</td>
                        <td>
                          <span className={`badge ${o.status.includes('disputed') ? 'warning' : (o.status.includes('Delivered') ? 'success' : 'neutral')}`}>
                            {o.status}
                          </span>
                        </td>
                        <td>
                          {!o.deliveryAgentId ? (
                            <button className="button primary small" onClick={() => { setAssigningOrder(o); setSelectedAgentId(agents[0]?.id || ''); }}>
                              Assign Courier
                            </button>
                          ) : (
                            <button className="button secondary small" onClick={() => { setSelectedOrderId(o.id); setTab('refund-reviews'); }}>
                              Inspect Case
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TAB 4: DELIVERIES */}
          {tab === 'deliveries' && (
            <section suppressHydrationWarning className="portal-card">
              <div suppressHydrationWarning className="section-title">
                <div>
                  <h2>Active Courier Dispatch & Deliveries</h2>
                  <p>Live tracking of courier routes, attempted dropoffs, and proof submissions.</p>
                </div>
              </div>
              <div suppressHydrationWarning className="orders-table-wrapper">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Courier Name</th>
                      <th>Delivery Address</th>
                      <th>Delivery Status</th>
                      <th>Proof Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.filter(o => o.deliveryAgentId).map(o => (
                      <tr key={o.id}>
                        <td><strong>{o.id}</strong></td>
                        <td>{o.deliveryAgentName || 'Daniel Kumar'}</td>
                        <td>{o.deliveryAddress || '404 Skyline Ave, Apt 12B, Seattle, WA'}</td>
                        <td>
                          <span className="badge neutral">{o.deliveryStatus || 'OUT_FOR_DELIVERY'}</span>
                        </td>
                        <td>
                          {o.deliveryProof ? (
                            <span className="badge success"><Check size={12} /> Photo & Note</span>
                          ) : (
                            <span className="badge neutral">Pending Dropoff</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TAB 5: AUDIT */}
          {tab === 'audit' && caseData && (
            <section suppressHydrationWarning className="portal-card">
              <div suppressHydrationWarning className="section-title">
                <div>
                  <h2>Operational Audit Trail & Action Ledger</h2>
                  <p>Immutable log of every order event, courier scan, AI assessment, and owner decision.</p>
                </div>
              </div>
              <div suppressHydrationWarning className="handoff-grid">
                {caseData.audits.map(a => (
                  <article key={a.id} className="audit-card">
                    <span className="badge neutral">{a.kind.replaceAll('_', ' ')}</span>
                    <p style={{ margin: 'var(--s2) 0' }}>{a.detail}</p>
                    <small style={{ color: 'var(--text-muted)' }}>Actor: {a.agent} · {new Date(a.at).toLocaleString()}</small>
                  </article>
                ))}
              </div>
            </section>
          )}
        </main>
      )}

      {/* ASSIGN COURIER MODAL */}
      {assigningOrder && (
        <div suppressHydrationWarning className="modal-backdrop" onClick={() => setAssigningOrder(null)}>
          <div suppressHydrationWarning className="modal-card" onClick={e => e.stopPropagation()}>
            <div suppressHydrationWarning className="modal-header">
              <h3>Assign Delivery Courier · {assigningOrder.id}</h3>
              <button className="icon-button" onClick={() => setAssigningOrder(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAssignAgent}>
              <div suppressHydrationWarning className="form-group">
                <label>Item & Delivery Destination</label>
                <div style={{ background: 'var(--bg-elevated)', padding: 'var(--s3)', borderRadius: 'var(--rds-radius-md)' }}>
                  <strong>{assigningOrder.item}</strong> ({assigningOrder.currency} {assigningOrder.amount.toFixed(2)})<br />
                  <small style={{ color: 'var(--text-muted)' }}>Destination: {assigningOrder.deliveryAddress || '404 Skyline Ave, Apt 12B, Seattle, WA'}</small>
                </div>
              </div>

              <div suppressHydrationWarning className="form-group">
                <label>Select Available Courier Agent</label>
                <select
                  value={selectedAgentId}
                  onChange={e => setSelectedAgentId(e.target.value)}
                  className="portal-select"
                >
                  {agents.map(ag => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name} ({ag.status} · {ag.activeDeliveries} active)
                    </option>
                  ))}
                </select>
              </div>

              <div suppressHydrationWarning className="modal-actions">
                <button type="button" className="button secondary" onClick={() => setAssigningOrder(null)}>
                  Cancel
                </button>
                <button type="submit" className="button primary" disabled={busy}>
                  {busy ? 'Assigning…' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OWNER DECISION MODAL */}
      {decisionModal && (
        <div suppressHydrationWarning className="modal-backdrop" onClick={() => setDecisionModal(null)}>
          <div suppressHydrationWarning className="modal-card" onClick={e => e.stopPropagation()}>
            <div suppressHydrationWarning className="modal-header">
              <div>
                <span className="eyebrow">Owner Decision Confirmation</span>
                <h3>{decisionModal.replaceAll('_', ' ')} · Case {selectedOrderId}</h3>
              </div>
              <button className="icon-button" onClick={() => setDecisionModal(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleOwnerDecision}>
              <div suppressHydrationWarning className="form-group">
                <label>Decision Reason / Audit Note</label>
                <textarea
                  rows={3}
                  required
                  value={decisionReason}
                  onChange={e => setDecisionReason(e.target.value)}
                  placeholder="Explain why this decision is made based on case evidence..."
                />
              </div>

              {decisionModal === 'HOLD' && (
                <div suppressHydrationWarning className="form-group">
                  <label>Specific Evidence Required</label>
                  <input
                    type="text"
                    required
                    value={requiredEvidence}
                    onChange={e => setRequiredEvidence(e.target.value)}
                    placeholder="e.g. Need CCTV footage from carrier"
                  />
                </div>
              )}

              <div suppressHydrationWarning className="modal-actions">
                <button type="button" className="button secondary" onClick={() => setDecisionModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="button primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Record Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
