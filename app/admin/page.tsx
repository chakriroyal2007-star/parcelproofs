'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Package, 
  ShieldCheck, 
  ArrowRight, 
  Clock3, 
  Check, 
  AlertTriangle, 
  FileText, 
  MessageSquare, 
  Users, 
  BookOpen, 
  LogOut, 
  Search, 
  SlidersHorizontal, 
  Sparkles, 
  CheckCircle2, 
  UserCheck, 
  Activity, 
  Layers,
  ArrowUpRight,
  ExternalLink,
  ChevronRight,
  X
} from 'lucide-react';
import type { Order, Source, User, Audit, CaseData, AdminIntakeReport } from '@/lib/types';

const date = (s: string) => new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
const money = (o: Order) => new Intl.NumberFormat('en-US', { style: 'currency', currency: o.currency }).format(o.amount);

interface AdminData {
  totalOrders: number;
  activeDisputes: number;
  overdueCommitments: number;
  evidenceConflicts: number;
  initiatedRefunds: number;
  recentAudits: Audit[];
  recentAIAudits: any[];
  orders: Order[];
  policies: Source[];
  agents: { id: string; name: string; email: string; status: string; activeCases: number; resolvedCases: number; assignedCases: string[] }[];
  intakeReports?: AdminIntakeReport[];
}

export default function AdminPortal() {
  const router = useRouter();
    const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'cases' | 'intake' | 'agents' | 'policies' | 'audit'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Selected report modal for full breakdown inspection
  const [viewingReport, setViewingReport] = useState<AdminIntakeReport | null>(null);

  // Selected case modal for deep inspection
  const [inspectingCaseId, setInspectingCaseId] = useState<string | null>(null);
  const [caseDetails, setCaseDetails] = useState<CaseData | null>(null);
  const [caseLoading, setCaseLoading] = useState(false);

  // Assign agent modal state
  const [assigningCase, setAssigningCase] = useState<string | null>(null);
  const [selectedAgentName, setSelectedAgentName] = useState('Priya Shah');
  const [assigningLoading, setAssigningLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.user || d.user.role !== 'ADMIN') {
          // Auto sign-in demo admin
          fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@parcelproof.com', password: 'password123' })
          })
            .then(r => r.json())
            .then(authData => {
              setCurrentUser(authData.user);
              loadAdminData();
            });
        } else {
          setCurrentUser(d.user);
          loadAdminData();
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  function loadAdminData() {
    setLoading(true);
    fetch('/api/admin/overview')
      .then(r => r.json())
      .then(d => {
        setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  async function openCaseInspector(caseId: string) {
    setInspectingCaseId(caseId);
    setCaseLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}`);
      const d = await res.json();
      setCaseDetails(d);
    } catch {
      setCaseDetails(null);
    } finally {
      setCaseLoading(false);
    }
  }

  async function handleAssignAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!assigningCase) return;
    setAssigningLoading(true);
    try {
      await fetch('/api/admin/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: assigningCase, agentName: selectedAgentName })
      });
      setAssigningCase(null);
      loadAdminData();
    } catch {
    } finally {
      setAssigningLoading(false);
    }
  }

  const filteredOrders = data?.orders.filter(o => {
    const matchesSearch = o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          o.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          o.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          o.speaker.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filterStatus === 'all') return true;
    if (filterStatus === 'disputed') return o.status.toLowerCase().includes('dispute') || o.status.toLowerCase().includes('unconfirmed');
    if (filterStatus === 'delivered') return o.status.toLowerCase() === 'delivered';
    return true;
  }) || [];


  return (
    <div suppressHydrationWarning className="portal-shell">
      {/* Header */}
      <header suppressHydrationWarning className="portal-header">
        <div suppressHydrationWarning className="portal-header-left">
          <div suppressHydrationWarning className="portal-brand">
            <span className="brand-dot" />
            <span className="brand-title">ParcelProof</span>
            <span className="brand-tag brand-tag-admin">Admin Intelligence</span>
          </div>
          <nav suppressHydrationWarning className="portal-nav">
            <button className={`portal-nav-btn ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
            <button className={`portal-nav-btn ${tab === 'cases' ? 'active' : ''}`} onClick={() => setTab('cases')}>Cases</button>
            <button className={`portal-nav-btn ${tab === 'intake' ? 'active' : ''}`} onClick={() => setTab('intake')}>
              AI Intake Reports {(data?.intakeReports?.length || 0) > 0 && <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: '10px', background: 'var(--blue)', color: '#fff', fontSize: '11px' }}>{data?.intakeReports?.length}</span>}
            </button>
            <button className={`portal-nav-btn ${tab === 'agents' ? 'active' : ''}`} onClick={() => setTab('agents')}>Agents</button>
            <button className={`portal-nav-btn ${tab === 'policies' ? 'active' : ''}`} onClick={() => setTab('policies')}>Policies</button>
            <button className={`portal-nav-btn ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>Audit Trail</button>
          </nav>
        </div>

        <div suppressHydrationWarning className="portal-header-right">
          <div suppressHydrationWarning className="portal-user-badge">
            <ShieldCheck size={14} className="badge-icon-admin" />
            <span className="user-name">{currentUser?.name || 'Sarah Connor'}</span>
            <span className="user-role-label">ADMIN</span>
          </div>
          <button className="portal-action-link" onClick={() => router.push('/agent')}>
            Agent Workspace <ArrowUpRight size={13} />
          </button>
          <button className="portal-icon-btn" onClick={handleLogout} title="Sign Out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main suppressHydrationWarning className="portal-content">
        {loading ? (
          <div suppressHydrationWarning className="portal-empty-state">
            <Clock3 className="spin-icon" size={32} />
            <p>Loading administration intelligence...</p>
          </div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {tab === 'overview' && (
              <div suppressHydrationWarning className="portal-grid-layout">
                {/* Metric Summary Cards */}
                <div suppressHydrationWarning className="admin-stats-row">
                  <div suppressHydrationWarning className="stat-box">
                    <span className="stat-label">Total Disputes Monitored</span>
                    <span className="stat-value">{data?.totalOrders || 0}</span>
                    <span className="stat-sub">Across US logistics networks</span>
                  </div>
                  <div suppressHydrationWarning className="stat-box stat-highlight-red">
                    <span className="stat-label">Active Dispute Cases</span>
                    <span className="stat-value text-red">{data?.activeDisputes || 0}</span>
                    <span className="stat-sub">Under active evidence review</span>
                  </div>
                  <div suppressHydrationWarning className="stat-box stat-highlight-amber">
                    <span className="stat-label">Overdue Commitments</span>
                    <span className="stat-value text-amber">{data?.overdueCommitments || 0}</span>
                    <span className="stat-sub">Prior SLA deadlines exceeded</span>
                  </div>
                  <div suppressHydrationWarning className="stat-box stat-highlight-blue">
                    <span className="stat-label">Evidence Conflicts</span>
                    <span className="stat-value text-blue">{data?.evidenceConflicts || 0}</span>
                    <span className="stat-sub">Contradictory GPS/Photo vs Customer</span>
                  </div>
                  <div suppressHydrationWarning className="stat-box stat-highlight-green">
                    <span className="stat-label">Approved Refund Actions</span>
                    <span className="stat-value text-green">{data?.initiatedRefunds || 0}</span>
                    <span className="stat-sub">Simulated human-approved actions</span>
                  </div>
                  <div suppressHydrationWarning className="stat-box" style={{ cursor: 'pointer', borderLeft: '3px solid var(--blue)' }} onClick={() => setTab('intake')}>
                    <span className="stat-label">AI Intake Reports</span>
                    <span className="stat-value text-blue">{data?.intakeReports?.length || 0}</span>
                    <span className="stat-sub">
                      {data?.intakeReports && data.intakeReports.length > 0 
                        ? `Avg Conf: ${Math.round(data.intakeReports.reduce((acc, r) => acc + r.confidenceScore, 0) / data.intakeReports.length)}%` 
                        : 'Customer Q&A reports'}
                    </span>
                  </div>
                </div>

                <div suppressHydrationWarning className="portal-two-col">
                  {/* Active Cases Snapshot */}
                  <div suppressHydrationWarning className="portal-card">
                    <div suppressHydrationWarning className="card-header">
                      <div suppressHydrationWarning className="card-title-group">
                        <Layers size={16} />
                        <h3>Operational Dispute Queue</h3>
                      </div>
                      <button className="portal-btn-sm" onClick={() => setTab('cases')}>View All Cases</button>
                    </div>
                    <div suppressHydrationWarning className="card-body p-0">
                      <table className="portal-table">
                        <thead>
                          <tr>
                            <th>Case ID</th>
                            <th>Merchant / Order</th>
                            <th>Status</th>
                            <th>AI Intelligence Signal</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data?.orders.map(o => (
                            <tr key={o.id}>
                              <td className="font-mono font-bold text-accent">{o.id}</td>
                              <td>
                                <div suppressHydrationWarning className="text-sm font-semibold">{o.item}</div>
                                <div suppressHydrationWarning className="text-xs text-sub">{money(o)} · {o.label}</div>
                              </td>
                              <td>
                                <span className={`status-pill status-${o.status.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>
                                  {o.status}
                                </span>
                              </td>
                              <td>
                                {o.id === 'PP-1042' && <span className="signal-badge signal-danger">Refund promise overdue · Conflict detected</span>}
                                {o.id === 'PP-1043' && <span className="signal-badge signal-success">Refund initiated · Guardrail active</span>}
                                {o.id === 'PP-1044' && <span className="signal-badge signal-info">Shared household · Identity partitioned</span>}
                                {o.id === 'PP-1045' && <span className="signal-badge signal-warning">Missing photo scan · Insufficient evidence</span>}
                              </td>
                              <td>
                                <button className="portal-btn-sm" onClick={() => openCaseInspector(o.id)}>Inspect</button>
                              </td>
                            </tr>
                          ))}

                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Realtime Governance & Audits */}
                  <div suppressHydrationWarning className="portal-card">
                    <div suppressHydrationWarning className="card-header">
                      <div suppressHydrationWarning className="card-title-group">
                        <Activity size={16} />
                        <h3>Immutable Action Audit Trail</h3>
                      </div>
                      <button className="portal-btn-sm" onClick={() => setTab('audit')}>Full Trail</button>
                    </div>
                    <div suppressHydrationWarning className="card-body p-0">
                      <div suppressHydrationWarning className="audit-feed">
                        {data?.recentAudits.slice(0, 6).map((a, idx) => (
                          <div key={idx} className="audit-entry">
                            <div suppressHydrationWarning className="audit-time">{date(a.at)}</div>
                            <div suppressHydrationWarning className="audit-main">
                              <div suppressHydrationWarning className="audit-header">
                                <span className="audit-agent">{a.agent}</span>
                                <span className="audit-kind">{a.kind.replace(/_/g, ' ')}</span>
                                <span className="audit-case font-mono">{a.orderId}</span>
                              </div>
                              <div suppressHydrationWarning className="audit-detail">{a.detail}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CASES TAB */}
            {tab === 'cases' && (
              <div suppressHydrationWarning className="portal-card">
                <div suppressHydrationWarning className="card-header">
                  <div suppressHydrationWarning className="card-title-group">
                    <Layers size={16} />
                    <h3>Enterprise Dispute Registry</h3>
                  </div>
                  <div suppressHydrationWarning className="search-filter-bar">
                    <div suppressHydrationWarning className="search-input-wrapper">
                      <Search size={14} className="search-icon" />
                      <input 
                        type="text" 
                        placeholder="Search by case ID, merchant, tracking..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="search-field"
                      />
                    </div>
                    <select 
                      value={filterStatus} 
                      onChange={e => setFilterStatus(e.target.value)}
                      className="portal-select"
                    >
                      <option value="all">All Statuses</option>
                      <option value="disputed">Disputed / Unconfirmed</option>
                      <option value="delivered">Delivered Normal</option>
                    </select>
                  </div>
                </div>

                <div suppressHydrationWarning className="card-body p-0">
                  <table className="portal-table">
                    <thead>
                      <tr>
                        <th>Case ID</th>
                        <th>Account ID</th>
                        <th>Carrier / Tracking</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>AI Operational Signal</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map(o => (
                        <tr key={o.id}>
                          <td className="font-mono font-bold text-accent">{o.id}</td>
                          <td className="font-mono text-xs">{o.accountId}</td>
                          <td>
                            <div suppressHydrationWarning className="text-sm font-semibold">{o.item}</div>
                            <div suppressHydrationWarning className="text-xs text-sub">{o.label}</div>
                          </td>
                          <td className="font-mono">{money(o)}</td>
                          <td>
                            <span className={`status-pill status-${o.status.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>
                              {o.status}
                            </span>
                          </td>
                          <td>
                            {o.id === 'PP-1042' && <span className="signal-badge signal-danger">Overdue refund promise · Courier contradiction</span>}
                            {o.id === 'PP-1043' && <span className="signal-badge signal-success">Refund initiated · Guardrail duplicate check</span>}
                            {o.id === 'PP-1044' && <span className="signal-badge signal-info">Shared household · Recipient validation</span>}
                            {o.id === 'PP-1045' && <span className="signal-badge signal-warning">No photo evidence · Escalation required</span>}
                            {o.id.startsWith('PP-CUST') && <span className="signal-badge signal-info">Customer filed · Live SQLite record</span>}
                          </td>
                          <td>
                            <div suppressHydrationWarning className="btn-group-row">
                              <button className="portal-btn-sm" onClick={() => openCaseInspector(o.id)}>Inspect</button>
                              <button className="portal-btn-sm btn-ghost" onClick={() => setAssigningCase(o.id)}>Assign</button>
                            </div>
                          </td>
                        </tr>
                      ))}

                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* AI INTAKE REPORTS TAB */}
            {tab === 'intake' && (
              <div suppressHydrationWarning className="portal-card">
                <div suppressHydrationWarning className="card-header">
                  <div suppressHydrationWarning className="card-title-group">
                    <Sparkles size={16} style={{ color: 'var(--blue)' }} />
                    <div>
                      <h3>AI Dispute Intake & Investigation Reports</h3>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
                        Automated scenario-adaptive customer interviews synthesized with carrier telemetry and multi-factor confidence scoring.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
                    <span className="badge success">
                      {data?.intakeReports?.length || 0} Reports Recorded
                    </span>
                  </div>
                </div>

                {(!data?.intakeReports || data.intakeReports.length === 0) ? (
                  <div suppressHydrationWarning className="portal-empty-state" style={{ padding: 'var(--s8) var(--s4)' }}>
                    <MessageSquare size={32} style={{ color: 'var(--muted)', margin: '0 auto var(--s2)' }} />
                    <p style={{ fontWeight: 600 }}>No Customer Intake Reports Submitted Yet</p>
                    <p style={{ fontSize: '12px', color: 'var(--muted)', maxWidth: 450 }}>
                      When customers chat with the AI Dispute Assistant in the Customer Portal and submit their answers, detailed investigation reports with confidence scores will appear here.
                    </p>
                  </div>
                ) : (
                  <div suppressHydrationWarning className="card-body p-0">
                    <table className="portal-table">
                      <thead>
                        <tr>
                          <th>Case ID</th>
                          <th>Customer & Account</th>
                          <th>Disputed Item</th>
                          <th>AI Confidence Score</th>
                          <th>Recommendation</th>
                          <th>Questions Asked</th>
                          <th>Submitted</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.intakeReports.map(rep => {
                          const confClass = rep.confidenceLevel === 'HIGH' 
                            ? 'confidence-high' 
                            : (rep.confidenceLevel === 'MEDIUM' ? 'confidence-medium' : 'confidence-low');
                          return (
                            <tr key={rep.reportId}>
                              <td>
                                <strong className="font-mono text-xs">{rep.caseId}</strong>
                              </td>
                              <td>
                                <div>
                                  <span style={{ fontWeight: 600 }}>{rep.customerName}</span>
                                  <small style={{ display: 'block', color: 'var(--muted)' }}>{rep.accountId}</small>
                                </div>
                              </td>
                              <td>
                                <div>
                                  <span>{rep.orderItem}</span>
                                  <small style={{ display: 'block', color: 'var(--muted)' }}>{rep.currency} {rep.orderAmount}</small>
                                </div>
                              </td>
                              <td>
                                <span className={`confidence-score-chip ${confClass}`}>
                                  <Sparkles size={11} /> {rep.confidenceScore}% {rep.confidenceLevel}
                                </span>
                              </td>
                              <td>
                                <span className={`status-pill ${rep.recommendedAction === 'FULL_REFUND' ? 'status-delivered' : 'status-disputed'}`}>
                                  {rep.recommendedAction.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="text-center font-mono text-xs">
                                {rep.questionsAskedCount} turns
                              </td>
                              <td className="text-xs text-sub">
                                {new Date(rep.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td>
                                <button className="portal-btn-sm" onClick={() => setViewingReport(rep)}>
                                  View Full Report
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* AGENTS TAB */}
            {tab === 'agents' && (
              <div suppressHydrationWarning className="portal-card">
                <div suppressHydrationWarning className="card-header">
                  <div suppressHydrationWarning className="card-title-group">
                    <Users size={16} />
                    <h3>Agent Operations & Shift Allocation</h3>
                  </div>
                </div>
                <div suppressHydrationWarning className="card-body p-0">
                  <table className="portal-table">
                    <thead>
                      <tr>
                        <th>Agent Name</th>
                        <th>Email</th>
                        <th>Operational Status</th>
                        <th>Active Assigned Cases</th>
                        <th>Resolved Cases</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.agents.map(ag => (
                        <tr key={ag.id}>
                          <td>
                            <div suppressHydrationWarning className="flex items-center gap-2">
                              <div suppressHydrationWarning className="avatar-circle">{ag.name.slice(0, 2).toUpperCase()}</div>
                              <span className="font-semibold">{ag.name}</span>
                            </div>
                          </td>
                          <td className="font-mono text-xs">{ag.email}</td>
                          <td>
                            <span className={`status-pill ${ag.status === 'Online' ? 'status-delivered' : ag.status === 'In Shift' ? 'status-disputed' : 'status-pending'}`}>
                              {ag.status}
                            </span>
                          </td>
                          <td className="font-mono font-semibold">{ag.activeCases} cases</td>
                          <td className="font-mono text-sub">{ag.resolvedCases} cases</td>
                          <td>
                            <button className="portal-btn-sm" onClick={() => {
                              setSelectedAgentName(ag.name);
                              setAssigningCase('PP-1042');
                            }}>
                              Allocate Case
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* POLICIES TAB */}
            {tab === 'policies' && (
              <div suppressHydrationWarning className="portal-card">
                <div suppressHydrationWarning className="card-header">
                  <div suppressHydrationWarning className="card-title-group">
                    <BookOpen size={16} />
                    <h3>Versioned Dispute Resolution Policies</h3>
                  </div>
                  <span className="text-xs text-sub">Grounding knowledge sources for RAG engine</span>
                </div>
                <div suppressHydrationWarning className="card-body">
                  <div suppressHydrationWarning className="policies-grid">
                    {data?.policies.map(pol => (
                      <div key={pol.id} className="policy-card">
                        <div suppressHydrationWarning className="policy-header">
                          <div suppressHydrationWarning className="policy-id-group">
                            <span className="font-mono font-bold text-accent">{pol.id}</span>
                            <span className="version-tag">v{pol.version || '2.0'}</span>
                          </div>
                          <span className={`status-pill ${!pol.effectiveTo ? 'status-delivered' : 'status-disputed'}`}>
                            {!pol.effectiveTo ? 'Active Policy' : 'Retired Policy'}
                          </span>
                        </div>
                        <h4 className="policy-title">{pol.title}</h4>
                        <div suppressHydrationWarning className="policy-meta">
                          <span>Region: <strong>{pol.region || 'US'}</strong></span>
                          <span>Effective: <strong>{pol.effectiveFrom ? date(pol.effectiveFrom) : 'Universal'}</strong></span>
                          {pol.effectiveTo && <span>Expired: <strong>{date(pol.effectiveTo)}</strong></span>}
                        </div>
                        <div suppressHydrationWarning className="policy-text-box font-mono text-xs">
                          {pol.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* AUDIT TAB */}
            {tab === 'audit' && (
              <div suppressHydrationWarning className="portal-card">
                <div suppressHydrationWarning className="card-header">
                  <div suppressHydrationWarning className="card-title-group">
                    <Activity size={16} />
                    <h3>Enterprise Governance & Audit Ledger</h3>
                  </div>
                </div>
                <div suppressHydrationWarning className="card-body p-0">
                  <table className="portal-table">
                    <thead>
                      <tr>
                        <th>Timestamp (UTC)</th>
                        <th>Actor</th>
                        <th>Action Kind</th>
                        <th>Case Scope</th>
                        <th>Details & State Commitment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.recentAudits.map((a, idx) => (
                        <tr key={idx}>
                          <td className="font-mono text-xs text-sub">{date(a.at)}</td>
                          <td className="font-semibold">{a.agent}</td>
                          <td>
                            <span className="status-pill status-delivered">
                              {a.kind.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="font-mono font-bold text-accent">{a.orderId}</td>
                          <td className="text-sm">{a.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* CASE INSPECTION MODAL */}
      {inspectingCaseId && (
        <div suppressHydrationWarning className="modal-backdrop" onClick={() => setInspectingCaseId(null)}>
          <div suppressHydrationWarning className="modal-content max-w-4xl" onClick={e => e.stopPropagation()}>
            <div suppressHydrationWarning className="modal-header">
              <div suppressHydrationWarning className="modal-title-group">
                <Sparkles size={16} className="text-accent" />
                <h3>Case Deep Inspection · {inspectingCaseId}</h3>
              </div>
              <button className="modal-close" onClick={() => setInspectingCaseId(null)}><X size={16} /></button>
            </div>
            <div suppressHydrationWarning className="modal-body">
              {caseLoading ? (
                <div suppressHydrationWarning className="p-8 text-center"><Clock3 className="spin-icon inline mr-2" /> Loading scoped AI intelligence...</div>
              ) : caseDetails ? (
                <div suppressHydrationWarning className="inspector-grid">
                  <div suppressHydrationWarning className="inspector-section">
                    <h4 className="section-title">Verified Order & Financial State</h4>
                    <div suppressHydrationWarning className="data-keyval-grid">
                      <div><span className="lbl">Item:</span> {caseDetails.order.item}</div>
                      <div><span className="lbl">Amount:</span> {money(caseDetails.order)}</div>
                      <div><span className="lbl">Recipient:</span> {caseDetails.order.recipient} ({caseDetails.order.region})</div>
                      <div><span className="lbl">Status:</span> {caseDetails.order.status}</div>
                      <div><span className="lbl">Refund Ledger:</span> <strong>{caseDetails.refund.status}</strong></div>
                    </div>
                  </div>

                  <div suppressHydrationWarning className="inspector-section">
                    <h4 className="section-title">AI Evidence Reconciliation Summary</h4>
                    <div suppressHydrationWarning className="brief-box">
                      {caseDetails.analysis ? (
                        <>
                          <div><strong>Headline:</strong> {caseDetails.analysis.narrative.headline.text}</div>
                          <div><strong>Gate Action:</strong> {caseDetails.analysis.gate.action} (Eligible: {caseDetails.analysis.gate.eligible ? 'Yes' : 'No'})</div>
                          <div><strong>Recommendation:</strong> {caseDetails.analysis.narrative.recommendation.title}</div>
                        </>
                      ) : (
                        <div>No AI analysis generated yet.</div>
                      )}
                    </div>
                  </div>

                  <div suppressHydrationWarning className="inspector-section">
                    <h4 className="section-title">Extracted Commitments & SLA Memory</h4>
                    {(!caseDetails.commitments || caseDetails.commitments.length === 0) ? (
                      <p className="text-xs text-sub">No explicit commitments recorded.</p>
                    ) : (
                      <div suppressHydrationWarning className="commitments-list">
                        {caseDetails.commitments.map((c, i) => (
                          <div key={i} className="commitment-pill">
                            <span className="badge-agent">{c.promisedBy}</span>: {c.statement} · Due: {c.deadline || 'None'}
                            <span className={`ml-2 font-bold ${c.status === 'OVERDUE' ? 'text-red' : 'text-green'}`}>[{c.status}]</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {caseDetails.intakeReport && (
                    <div suppressHydrationWarning className="inspector-section" style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                        <h4 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Sparkles size={15} style={{ color: 'var(--blue)' }} /> Customer AI Intake Report & Confidence Score
                        </h4>
                        <span className={`confidence-score-chip ${caseDetails.intakeReport.confidenceLevel === 'HIGH' ? 'confidence-high' : 'confidence-medium'}`}>
                          {caseDetails.intakeReport.confidenceScore}% {caseDetails.intakeReport.confidenceLevel} CONFIDENCE
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', margin: '4px 0 8px 0', color: 'var(--ink)' }}>
                        {caseDetails.intakeReport.executiveSummary}
                      </p>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
                        <span>Consistency: <strong>{caseDetails.intakeReport.confidenceBreakdown.evidenceConsistency}%</strong></span>
                        <span>Courier Conflict: <strong>{caseDetails.intakeReport.confidenceBreakdown.courierConflictIndex}%</strong></span>
                        <span>Plausibility: <strong>{caseDetails.intakeReport.confidenceBreakdown.plausibilityScore}%</strong></span>
                        <span>Recommendation: <strong style={{ color: 'var(--ink)' }}>{caseDetails.intakeReport.recommendedAction}</strong></span>
                      </div>
                      <button className="portal-btn-sm" onClick={() => setViewingReport(caseDetails.intakeReport!)}>
                        Inspect Full Investigation Transcript ({caseDetails.intakeReport.questionsAskedCount} turns)
                      </button>
                    </div>
                  )}
                </div>

              ) : (
                <div suppressHydrationWarning className="p-4 text-sub">Could not load case details.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN AGENT MODAL */}
      {assigningCase && (
        <div suppressHydrationWarning className="modal-backdrop" onClick={() => setAssigningCase(null)}>
          <div suppressHydrationWarning className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div suppressHydrationWarning className="modal-header">
              <div suppressHydrationWarning className="modal-title-group">
                <UserCheck size={16} />
                <h3>Assign Case {assigningCase}</h3>
              </div>
              <button className="modal-close" onClick={() => setAssigningCase(null)}><X size={16} /></button>
            </div>
            <form onSubmit={handleAssignAgent}>
              <div suppressHydrationWarning className="modal-body">
                <p className="text-sm text-sub mb-4">Allocate this dispute to an active support specialist shift:</p>
                <div suppressHydrationWarning className="form-group">
                  <label>Select Agent</label>
                  <select 
                    value={selectedAgentName} 
                    onChange={e => setSelectedAgentName(e.target.value)}
                    className="portal-input"
                  >
                    <option value="Priya Shah">Priya Shah (Online)</option>
                    <option value="Daniel Kim">Daniel Kim (In Shift)</option>
                    <option value="Maya Chen">Maya Chen (Escalation Lead)</option>
                  </select>
                </div>
              </div>
              <div suppressHydrationWarning className="modal-footer">
                <button type="button" className="portal-btn-sm btn-ghost" onClick={() => setAssigningCase(null)}>Cancel</button>
                <button type="submit" className="portal-btn-sm" disabled={assigningLoading}>
                  {assigningLoading ? 'Allocating...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL INTAKE REPORT MODAL */}
      {viewingReport && (
        <div suppressHydrationWarning className="report-modal-backdrop" onClick={() => setViewingReport(null)}>
          <div suppressHydrationWarning className="report-modal" onClick={e => e.stopPropagation()}>
            <div suppressHydrationWarning className="report-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span className="brand-tag brand-tag-admin">Official Dispute Reconstruction</span>
                  <span className="font-mono text-xs text-sub">{viewingReport.reportId}</span>
                </div>
                <h3 style={{ margin: 0, fontSize: '20px' }}>
                  Case {viewingReport.caseId} · Dispute Investigation Report
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                  Customer: <strong>{viewingReport.customerName}</strong> ({viewingReport.accountId}) · Item: <strong>{viewingReport.orderItem}</strong> ({viewingReport.currency} {viewingReport.orderAmount})
                </p>
              </div>
              <button className="modal-close" onClick={() => setViewingReport(null)}><X size={18} /></button>
            </div>

            {/* CONFIDENCE SCORE GAUGE */}
            <div suppressHydrationWarning className="report-section" style={{ background: '#fdfbf7', border: '1px solid #f0cc72' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', display: 'block', fontWeight: 700 }}>
                    AI Overall Confidence Score
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '32px', fontWeight: 800, color: viewingReport.confidenceScore >= 80 ? '#137333' : '#b06000' }}>
                      {viewingReport.confidenceScore}%
                    </span>
                    <span className={`confidence-score-chip ${viewingReport.confidenceLevel === 'HIGH' ? 'confidence-high' : 'confidence-medium'}`}>
                      {viewingReport.confidenceLevel} CONFIDENCE
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Evidence Consistency</span>
                    <strong style={{ fontSize: '15px' }}>{viewingReport.confidenceBreakdown.evidenceConsistency}%</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Courier Conflict Index</span>
                    <strong style={{ fontSize: '15px' }}>{viewingReport.confidenceBreakdown.courierConflictIndex}%</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Customer Plausibility</span>
                    <strong style={{ fontSize: '15px' }}>{viewingReport.confidenceBreakdown.plausibilityScore}%</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* EXECUTIVE SYNOPSIS */}
            <div suppressHydrationWarning className="report-section">
              <h4><FileText size={15} /> Executive Synopsis</h4>
              <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.6, color: 'var(--ink)' }}>
                {viewingReport.executiveSummary}
              </p>
            </div>

            {/* EXTRACTED FACTS & CONTRADICTIONS */}
            <div suppressHydrationWarning style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s3)' }}>
              <div suppressHydrationWarning className="report-section">
                <h4><CheckCircle2 size={15} style={{ color: 'var(--green)' }} /> Extracted Customer Statements</h4>
                <ul className="report-tag-list">
                  {viewingReport.extractedFacts.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>

              <div suppressHydrationWarning className="report-section">
                <h4><AlertTriangle size={15} style={{ color: 'var(--amber)' }} /> Detected Discrepancies</h4>
                {viewingReport.detectedContradictions.length > 0 ? (
                  <ul className="report-tag-list">
                    {viewingReport.detectedContradictions.map((c, i) => (
                      <li key={i} style={{ color: '#b3311f' }}>{c}</li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No direct physical contradiction flagged.</p>
                )}
              </div>
            </div>

            {/* TELEMETRY & RECOMMENDATION */}
            <div suppressHydrationWarning className="report-section">
              <h4><ShieldCheck size={15} style={{ color: 'var(--blue)' }} /> Recommended Operational Action</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span className={`status-pill ${viewingReport.recommendedAction === 'FULL_REFUND' ? 'status-delivered' : 'status-disputed'}`} style={{ fontSize: '13px', padding: '4px 10px' }}>
                  {viewingReport.recommendedAction.replace('_', ' ')}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  Evaluated under ParcelProof US Delivery Resolution Framework
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink)', lineHeight: 1.5 }}>
                {viewingReport.actionRationale}
              </p>
            </div>

            {/* COMPLETE INTERVIEW TRANSCRIPT */}
            <div suppressHydrationWarning className="report-section">
              <h4><MessageSquare size={15} /> Complete Investigation Interview Transcript ({viewingReport.questionsAskedCount} turns)</h4>
              <div className="report-transcript-list" style={{ marginTop: '10px' }}>
                {viewingReport.interviewTranscript.map((t, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div className="transcript-bubble q">
                      <strong>AI Question {idx + 1}:</strong> {t.question}
                    </div>
                    <div className="transcript-bubble a">
                      <strong>Customer Response:</strong> {t.answer}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--s2)' }}>
              <button className="button primary" onClick={() => setViewingReport(null)}>
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
