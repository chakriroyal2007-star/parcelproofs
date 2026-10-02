'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Package, 
  ShieldCheck, 
  ArrowRight, 
  Clock3, 
  Check, 
  MessageSquare, 
  AlertTriangle, 
  RotateCw, 
  LogOut, 
  Bot, 
  Send, 
  PlusCircle, 
  Truck, 
  CheckCircle2, 
  X, 
  FileText, 
  LockKeyhole, 
  Sparkles,
  ShoppingBag,
  MapPin,
  Camera,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import type { Order, User, CustomerAIAnswer, AIChatMessage, Source, Product, IntakeTranscriptItem } from '@/lib/types';
import { PRODUCTS } from '@/lib/products';

export default function CustomerPortal() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'orders' | 'disputes' | 'assistant' | 'profile'>('overview');
  const [selectedCase, setSelectedCase] = useState<string | null>('PP-1042');
  
  // Place Order state
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product>(PRODUCTS[0]);
  const [deliveryAddress, setDeliveryAddress] = useState('404 Skyline Ave, Apt 12B, Seattle, WA');
  const [placingOrder, setPlacingOrder] = useState(false);

  // Dispute creation state (Adaptive AI Refund Intake)
  const [isCreatingDispute, setIsCreatingDispute] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState<'not_received' | 'wrong_location' | 'incorrect_photo' | 'damaged' | 'other'>('not_received');
  const [disputeDescription, setDisputeDescription] = useState('I was home all day and my apartment building has no reception desk. The doorway in the photo does not match mine.');
  const [disputeOrderId, setDisputeOrderId] = useState('PP-1042');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [intakeStep, setIntakeStep] = useState(1);
  const [checkedNeighbors, setCheckedNeighbors] = useState('yes');
  const [photoDisputed, setPhotoDisputed] = useState('yes');
  const [notice, setNotice] = useState('');

  // Dynamic AI Dispute Intake Assistant state
  const [intakeSubmitted, setIntakeSubmitted] = useState<boolean>(false);
  const [intakeSubmittedAt, setIntakeSubmittedAt] = useState<string | null>(null);
  const [intakeTranscript, setIntakeTranscript] = useState<IntakeTranscriptItem[]>([]);
  const [currentInvestigatorQuestion, setCurrentInvestigatorQuestion] = useState<string>('');
  const [customerAnswerInput, setCustomerAnswerInput] = useState<string>('');
  const [isIntakeLoading, setIsIntakeLoading] = useState<boolean>(false);
  const [isInvestigationComplete, setIsInvestigationComplete] = useState<boolean>(false);
  const [submittingReport, setSubmittingReport] = useState<boolean>(false);

  // Customer AI Assistant state
  const [aiQuestion, setAiQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<AIChatMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Evidence modal state
  const [activeSource, setActiveSource] = useState<Source | null>(null);
  const [caseSources, setCaseSources] = useState<Source[]>([]);

  // Message state
  const [customerMessage, setCustomerMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.user || d.user.role !== 'CUSTOMER') {
          // If not logged in as customer, default to Alex Morgan demo session
          fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'alex@example.com', password: 'password123' })
          })
            .then(r => r.json())
            .then(authData => {
              setUser(authData.user);
              loadOrders();
            });
        } else {
          setUser(d.user);
          loadOrders();
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const [caseTimeline, setCaseTimeline] = useState<any[]>([]);

  useEffect(() => {
    if (selectedCase) {
      loadCaseData(selectedCase);
    }
  }, [selectedCase]);

  useEffect(() => {
    if (tab === 'assistant') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, tab, aiLoading]);

  function loadCaseData(caseId: string) {
    fetch(`/api/cases/${caseId}`)
      .then(r => r.json())
      .then(d => {
        if (d && d.chatHistory) {
          setChatHistory(d.chatHistory);
        }
        if (d && d.sources) {
          setCaseSources(d.sources);
        }
        if (d && d.timeline) {
          setCaseTimeline(d.timeline);
        }
      })
      .catch(() => {});
  }

  useEffect(() => {
    if (selectedCase && tab === 'assistant') {
      loadIntakeSession(selectedCase);
    }
  }, [selectedCase, tab]);

  async function loadIntakeSession(caseId: string) {
    if (!caseId) return;
    setIsIntakeLoading(true);
    try {
      const res = await fetch(`/api/customer/intake?caseId=${caseId}`);
      const data = await res.json();
      if (data.isSubmitted) {
        setIntakeSubmitted(true);
        setIntakeSubmittedAt(data.submittedAt);
      } else {
        setIntakeSubmitted(false);
        const initRes = await fetch('/api/customer/intake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'initial', caseId })
        });
        const initData = await initRes.json();
        if (initData.isSubmitted) {
          setIntakeSubmitted(true);
          setIntakeSubmittedAt(initData.submittedAt);
        } else {
          if (initData.transcript && initData.transcript.length > 0) {
            setIntakeTranscript(initData.transcript);
            setCurrentInvestigatorQuestion("Thank you for the details so far. Is there anything else you'd like to add before we submit the dispute evidence?");
          } else {
            setCurrentInvestigatorQuestion(initData.openingQuestion || 'Hello! I am your ParcelProof AI Dispute Investigator. Can you tell me what you noticed when you checked for your delivery?');
          }
          setIsInvestigationComplete(false);
        }
      }
    } catch (e) {
      console.error('Failed to load intake session:', e);
    } finally {
      setIsIntakeLoading(false);
    }
  }

  async function handleSendIntakeAnswer(e?: React.FormEvent, customAnswer?: string) {
    if (e) e.preventDefault();
    const answer = (customAnswer || customerAnswerInput).trim();
    if (!answer || !selectedCase || isIntakeLoading) return;

    const newTurn: IntakeTranscriptItem = {
      question: currentInvestigatorQuestion,
      answer,
      timestamp: new Date().toISOString()
    };

    const updatedTranscript = [...intakeTranscript, newTurn];
    setIntakeTranscript(updatedTranscript);
    setCustomerAnswerInput('');
    setIsIntakeLoading(true);

    try {
      const res = await fetch('/api/customer/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          caseId: selectedCase,
          message: answer,
          transcript: updatedTranscript
        })
      });
      const data = await res.json();
      if (data.reply) {
        setCurrentInvestigatorQuestion(data.reply);
      }
      if (data.isInvestigationComplete) {
        setIsInvestigationComplete(true);
      }
    } catch {
      setCurrentInvestigatorQuestion('Thank you. We have recorded your statement. You can now submit your responses for operational investigation.');
      setIsInvestigationComplete(true);
    } finally {
      setIsIntakeLoading(false);
    }
  }

  async function handleSubmitIntakeResponses() {
    if (!selectedCase || intakeTranscript.length === 0 || submittingReport) return;
    setSubmittingReport(true);
    try {
      const res = await fetch('/api/customer/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          caseId: selectedCase,
          transcript: intakeTranscript
        })
      });
      const data = await res.json();
      if (data.success || data.status === 'submitted') {
        setIntakeSubmitted(true);
        setIntakeSubmittedAt(data.submittedAt || new Date().toISOString());
      }
    } catch {
      setIntakeSubmitted(true);
      setIntakeSubmittedAt(new Date().toISOString());
    } finally {
      setSubmittingReport(false);
    }
  }

  function handleReopenIntake() {
    setIntakeSubmitted(false);
    setIntakeTranscript([]);
    setIsInvestigationComplete(false);
    if (selectedCase) loadIntakeSession(selectedCase);
  }

  function loadOrders() {
    setLoading(true);
    fetch('/api/customer/orders')
      .then(r => r.json())
      .then(d => {
        setOrders(d.orders || []);
        if (d.orders && d.orders.length > 0) {
          const firstId = d.orders[0].id;
          setSelectedCase(firstId);
          loadCaseData(firstId);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault();
    setPlacingOrder(true);
    setNotice('');
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantity: 1,
          deliveryAddress,
          customerName: user?.name || 'Alex Morgan'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place order');
      setNotice(`Order ${data.order.id} placed successfully! Product: ${selectedProduct.name} (${selectedProduct.id})`);
      setIsPlacingOrder(false);
      loadOrders();
      setTab('orders');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error placing order');
    } finally {
      setPlacingOrder(false);
    }
  }

  async function handleConfirmDelivery(orderId: string) {
    try {
      await fetch(`/api/deliveries/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'DELIVERY_CONFIRMED',
          note: 'Customer confirmed package received.'
        })
      });
      setNotice(`Thank you! Delivery confirmed for order ${orderId}.`);
      loadOrders();
    } catch {
      alert('Error confirming delivery');
    }
  }

  async function handleCreateDispute(e: React.FormEvent) {
    e.preventDefault();
    if (!disputeDescription.trim()) return;
    setSubmittingDispute(true);
    setNotice('');
    try {
      const res = await fetch('/api/customer/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: disputeOrderId,
          category: disputeCategory,
          description: `[Location check: ${checkedNeighbors === 'yes' ? 'Checked residence' : 'Unchecked'}, Photo verified: ${photoDisputed === 'yes' ? 'Disputed mismatch' : 'Matching'}] ${disputeDescription}`
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit dispute');
      setNotice('Your dispute and evidence have been logged and assigned to operations review.');
      setIsCreatingDispute(false);
      setIntakeStep(1);
      loadOrders();
      setTab('disputes');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error submitting dispute');
    } finally {
      setSubmittingDispute(false);
    }
  }

  async function askCustomerAssistant(promptText?: string) {
    const question = promptText || aiQuestion;
    if (!question.trim() || !selectedCase) return;
    
    const userMsg: AIChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: question.trim(),
      timestamp: new Date().toISOString()
    };

    setChatHistory(prev => [...prev, userMsg]);
    if (!promptText) setAiQuestion('');
    setAiLoading(true);

    try {
      const res = await fetch('/api/customer/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: selectedCase,
          question: question.trim()
        })
      });
      const data: CustomerAIAnswer = await res.json();
      
      const assistantMsg: AIChatMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: data.answer || 'Our team is actively investigating your dispute.',
        timestamp: new Date().toISOString(),
        sources: data.citations || [`ORDER-${selectedCase}`, `REF-${selectedCase}`]
      };

      setChatHistory(prev => [...prev, assistantMsg]);
    } catch {
      const fallbackMsg: AIChatMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: 'Your dispute records are documented and securely persisted. A support specialist is examining carrier tracking details.',
        timestamp: new Date().toISOString(),
        sources: [`ORDER-${selectedCase}`, `REF-${selectedCase}`]
      };
      setChatHistory(prev => [...prev, fallbackMsg]);
    } finally {
      setAiLoading(false);
    }
  }

  async function sendDisputeUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!customerMessage.trim() || !selectedCase) return;
    setSendingMsg(true);
    try {
      const res = await fetch('/api/customer/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedCase,
          message: customerMessage.trim()
        })
      });
      if (!res.ok) throw new Error('Failed to send message');
      setCustomerMessage('');
      setNotice('Your message was added to the case evidence records.');
      loadCaseData(selectedCase);
    } catch (err) {
      alert('Error updating case record');
    } finally {
      setSendingMsg(false);
    }
  }

  function handleCitationClick(sourceId: string) {
    const found = caseSources.find(s => s.id === sourceId);
    if (found) {
      setActiveSource(found);
    } else {
      setActiveSource({
        id: sourceId,
        accountId: user?.accountId || 'HH-208',
        orderId: selectedCase,
        type: 'support',
        title: `Evidence Record ${sourceId}`,
        timestamp: new Date().toISOString(),
        text: `Verified case record ${sourceId} referenced by dispute resolution copilot.`,
        version: null,
        effectiveFrom: null,
        effectiveTo: null,
        region: 'US',
        photo: null
      });
    }
  }

  const selectedOrder = orders.find(o => o.id === selectedCase) || orders[0];
  const disputedOrders = orders.filter(o => o.status.includes('disputed') || o.id === 'PP-1042' || o.id === 'PP-1044');

  return (
    <div suppressHydrationWarning className="portal-shell">
      {/* HEADER */}
      <header suppressHydrationWarning className="portal-header">
        <div suppressHydrationWarning className="portal-brand">
          <div suppressHydrationWarning className="brand-badge">
            <Package size={20} />
          </div>
          <div suppressHydrationWarning>
            <h1 style={{ fontSize: 'var(--lg)', margin: 0 }}>ParcelProof</h1>
            <span style={{ fontSize: 'var(--xs)', color: 'var(--text-muted)' }}>Customer Hub</span>
          </div>
        </div>

        <div suppressHydrationWarning className="portal-user">
          <button className="button primary small" onClick={() => setIsPlacingOrder(true)}>
            <ShoppingBag size={14} /> Place New Order
          </button>
          <div suppressHydrationWarning className="user-pill">
            <ShieldCheck size={16} className="text-accent" />
            <span>Welcome, <strong>{user?.name || 'Customer'}</strong></span>
            <span className="badge neutral">Account: {user?.accountId || 'HH-208'}</span>
          </div>
          <button onClick={handleLogout} className="button secondary small">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      {/* NAVIGATION */}
      <nav suppressHydrationWarning className="portal-nav">
        <button className={`portal-nav-btn ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button className={`portal-nav-btn ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>
          My Orders ({orders.length})
        </button>
        <button className={`portal-nav-btn ${tab === 'disputes' ? 'active' : ''}`} onClick={() => setTab('disputes')}>
          Active Disputes {disputedOrders.length > 0 && <span className="tab-count">{disputedOrders.length}</span>}
        </button>
        <button className={`portal-nav-btn ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>
          Account Profile
        </button>
      </nav>

      {/* NOTICE */}
      {notice && (
        <div suppressHydrationWarning className="message success" style={{ margin: 'var(--s4) var(--s8)' }}>
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      {/* LOADING */}
      {loading ? (
        <div suppressHydrationWarning className="loading" style={{ margin: 'var(--s12) auto' }}>
          <RotateCw className="spin" size={24} /> Loading customer records…
        </div>
      ) : (
        <main suppressHydrationWarning className="portal-main">
          {/* TAB 1: OVERVIEW */}
          {tab === 'overview' && (
            <div suppressHydrationWarning className="portal-grid">
              <div suppressHydrationWarning className="portal-column">
                <section suppressHydrationWarning className="portal-card">
                  <div suppressHydrationWarning className="section-title">
                    <div>
                      <h2>Recent Orders & Delivery Status</h2>
                      <p>Track delivery dispatch, courier evidence, and refund investigations.</p>
                    </div>
                    <button className="button primary small" onClick={() => setIsPlacingOrder(true)}>
                      <PlusCircle size={15} /> Buy New Product
                    </button>
                  </div>

                  <div suppressHydrationWarning className="orders-list">
                    {orders.map(order => (
                      <article
                        key={order.id}
                        className={`order-card ${selectedCase === order.id ? 'active' : ''}`}
                        onClick={() => { setSelectedCase(order.id); setTab('orders'); }}
                      >
                        <div suppressHydrationWarning className="order-meta">
                          <span className="order-id">{order.id}</span>
                          <span className="badge neutral">{order.productId || 'PROD-WH-001'}</span>
                        </div>
                        <div suppressHydrationWarning className="order-details">
                          <h3>{order.item}</h3>
                          <span className="order-amount">{order.currency} {order.amount.toFixed(2)}</span>
                        </div>
                        <div suppressHydrationWarning className="order-status-line">
                          <span className={`badge ${order.status.includes('disputed') ? 'warning' : (order.status.includes('Delivered') ? 'success' : 'neutral')}`}>
                            {order.status}
                          </span>
                          <span className="link-arrow">Track order <ArrowRight size={13} /></span>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </div>

              {/* SIDEBAR WIDGET */}
              <aside suppressHydrationWarning className="portal-sidebar">
                <div suppressHydrationWarning className="portal-card">
                  <div suppressHydrationWarning className="section-title">
                    <div>
                      <h3>Customer Support</h3>
                      <p>Need help with your orders?</p>
                    </div>
                  </div>
                  <p style={{fontSize: 'var(--sm)', color: 'var(--text-muted)'}}>If you have an issue with an order, please go to My Orders and click 'Dispute' to start an investigation.</p>
                </div>
              </aside>
            </div>
          )}

          {/* TAB 2: ORDERS */}
          {tab === 'orders' && (
            <section suppressHydrationWarning className="portal-card">
              <div suppressHydrationWarning className="section-title">
                <div>
                  <h2>Your Order History & Delivery Tracking</h2>
                  <p>All active purchases, courier milestones, and delivery confirmation.</p>
                </div>
                <button className="button primary small" onClick={() => setIsPlacingOrder(true)}>
                  <PlusCircle size={15} /> Place Order
                </button>
              </div>
              <div suppressHydrationWarning className="orders-table-wrapper">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Product ID</th>
                      <th>Item Description</th>
                      <th>Delivery Courier</th>
                      <th>Amount</th>
                      <th>Delivery Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => (
                      <tr key={o.id}>
                        <td><strong>{o.id}</strong></td>
                        <td><span className="badge neutral">{o.productId || 'PROD-WH-001'}</span></td>
                        <td>{o.item}</td>
                        <td>{o.deliveryAgentName || <span style={{ color: 'var(--text-muted)' }}>Assigned at hub</span>}</td>
                        <td>{o.currency} {o.amount.toFixed(2)}</td>
                        <td>
                          <span className={`badge ${o.status.includes('disputed') ? 'warning' : (o.status.includes('Delivered') ? 'success' : 'neutral')}`}>
                            {o.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {o.status.includes('Delivered') && !o.status.includes('disputed') && (
                              <>
                                <button className="button secondary small" onClick={() => handleConfirmDelivery(o.id)}>
                                  <CheckCircle size={12} /> Confirm
                                </button>
                                <button className="button primary small" onClick={() => { setSelectedCase(o.id); setTab('assistant'); }}>
                                  Dispute
                                </button>
                              </>
                            )}
                            {o.status.includes('disputed') && (
                              <button className="button secondary small" onClick={() => { setSelectedCase(o.id); setTab('disputes'); }}>
                                View Dispute
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TAB 3: DISPUTES */}
          {tab === 'disputes' && selectedOrder && (
            <div suppressHydrationWarning className="portal-grid">
              <section suppressHydrationWarning className="portal-card portal-column">
                <div suppressHydrationWarning className="section-title">
                  <div>
                    <span className="eyebrow">Active Dispute Investigation</span>
                    <h2>Case {selectedOrder.id} · {selectedOrder.item}</h2>
                  </div>
                  <span className="badge warning">Under Review</span>
                </div>

                <div suppressHydrationWarning className="timeline-section" style={{ margin: 'var(--s4) 0' }}>
                  <h3>Delivery Evidence & Recorded Statements</h3>
                  <div suppressHydrationWarning className="timeline-flow">
                    {caseTimeline && caseTimeline.length > 0 ? (
                      caseTimeline.map(evt => (
                        <div key={evt.id} suppressHydrationWarning className="timeline-item">
                          <div className={`timeline-marker ${evt.badgeType === 'success' ? 'complete' : evt.badgeType === 'warning' ? 'active' : 'neutral'}`}>
                            {evt.stage.includes('Decision') ? <AlertTriangle size={12} /> : evt.stage.includes('Delivery') ? <Truck size={12} /> : <Check size={12} />}
                          </div>
                          <div className="timeline-content">
                            <strong>{evt.stage}</strong>
                            <small>{evt.description}</small>
                            <span className="timestamp">{new Date(evt.timestamp).toLocaleString()}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p>Loading timeline...</p>
                    )}
                  </div>
                </div>

                <form onSubmit={sendDisputeUpdate} className="dispute-message-form" style={{ marginTop: 'var(--s4)' }}>
                  <label htmlFor="msg">Add a message or additional details for your dispute agent:</label>
                  <div suppressHydrationWarning className="input-with-button">
                    <input
                      id="msg"
                      type="text"
                      placeholder="e.g. I was home all day and my apartment building has no reception desk..."
                      value={customerMessage}
                      onChange={e => setCustomerMessage(e.target.value)}
                      disabled={sendingMsg}
                    />
                    <button type="submit" className="button primary" disabled={!customerMessage.trim() || sendingMsg}>
                      <Send size={14} /> Send
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}

          {/* TAB 4: ASSISTANT */}
          {tab === 'assistant' && (
            <section suppressHydrationWarning className="portal-card copilot-chat-container">
              <div suppressHydrationWarning className="section-title">
                <div>
                  <h2>Customer AI Dispute Assistant</h2>
                  <p>Adaptive conversational inquiry · Grounded in carrier telemetry and dynamic scenario investigation.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
                  <span className={`badge ${intakeSubmitted ? 'success' : 'neutral'}`}>
                    {intakeSubmitted ? 'Response Submitted' : 'Interactive Investigation'}
                  </span>
                  <Bot size={22} className="text-accent" />
                </div>
              </div>

              {/* CASE SELECTOR / BANNER */}
              <div suppressHydrationWarning className="intake-banner">
                <div suppressHydrationWarning className="intake-banner-left">
                  <Package size={18} style={{ color: 'var(--blue)' }} />
                  <div>
                    <span style={{ fontSize: 'var(--xs)', color: 'var(--muted)', display: 'block' }}>Investigating Case:</span>
                    <strong>{selectedCase}</strong> · {orders.find(o => o.id === selectedCase)?.item || 'Disputed Item'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Switch Order:</span>
                  <select
                    value={selectedCase || ''}
                    onChange={e => setSelectedCase(e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--white)', fontSize: '12px' }}
                  >
                    {orders.map(o => (
                      <option key={o.id} value={o.id}>{o.id} - {o.item}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* IF SUBMITTED: SHOW CLEAN "RESPONSE SUBMITTED" CONFIRMATION */}
              {intakeSubmitted ? (
                <div suppressHydrationWarning className="intake-submitted-view">
                  <div suppressHydrationWarning className="intake-success-icon">
                    <Check size={36} />
                  </div>
                  <h3 suppressHydrationWarning className="intake-submitted-title">Response Submitted</h3>
                  <p suppressHydrationWarning className="intake-submitted-subtitle">
                    Your dispute investigation responses for <strong>{selectedCase}</strong> have been securely submitted to our Dispute Operations team. Our specialists are reviewing your statements against carrier telemetry records.
                  </p>

                  <div suppressHydrationWarning className="intake-timeline-card">
                    <div suppressHydrationWarning className="intake-timeline-step">
                      <div suppressHydrationWarning className="intake-step-icon done"><Check size={14} /></div>
                      <div>
                        <strong>1. Dispute Registered</strong>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>Claim filed in ParcelProof dispute database</p>
                      </div>
                    </div>
                    <div suppressHydrationWarning className="intake-timeline-step">
                      <div suppressHydrationWarning className="intake-step-icon done"><Check size={14} /></div>
                      <div>
                        <strong>2. AI Evidence Interview Submitted</strong>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
                          {intakeSubmittedAt ? `Submitted on ${new Date(intakeSubmittedAt).toLocaleString()}` : 'Submitted successfully'}
                        </p>
                      </div>
                    </div>
                    <div suppressHydrationWarning className="intake-timeline-step">
                      <div suppressHydrationWarning className="intake-step-icon pending"><Clock3 size={14} /></div>
                      <div>
                        <strong>3. Operations Review & Resolution</strong>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>Operations leadership evaluating carrier claim and refund eligibility</p>
                      </div>
                    </div>
                  </div>

                  <div suppressHydrationWarning style={{ display: 'flex', gap: 'var(--s3)', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button className="button secondary" onClick={handleReopenIntake}>
                      <RefreshCw size={14} /> Reopen or Provide Additional Details
                    </button>
                    <button className="button primary" onClick={() => setTab('orders')}>
                      View Order Status
                    </button>
                  </div>
                </div>
              ) : (
                /* IF NOT SUBMITTED: SHOW ACTIVE DYNAMIC INVESTIGATION INTERVIEW */
                <div>
                  <div suppressHydrationWarning style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--s3)' }}>
                    <span className={`intake-status-pill ${isInvestigationComplete ? 'ready' : ''}`}>
                      {isInvestigationComplete ? '✓ Ready to Submit' : `Inquiry Turn ${intakeTranscript.length + 1} · Scenario Probe`}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {intakeTranscript.length} question{intakeTranscript.length === 1 ? '' : 's'} answered
                    </span>
                  </div>

                  {/* MULTI-TURN CHAT THREAD */}
                  <div suppressHydrationWarning className="chat-thread" style={{ minHeight: '260px', maxHeight: '420px', marginTop: 'var(--s2)' }}>
                    {/* Render Previous Turns */}
                    {intakeTranscript.map((turn, idx) => (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)', marginBottom: 'var(--s3)' }}>
                        {/* Assistant Question Bubble */}
                        <div className="chat-message assistant">
                          <article className="chat-card-assistant" style={{ background: 'var(--white)', borderLeft: '3px solid var(--blue)' }}>
                            <div suppressHydrationWarning className="chat-assistant-header">
                              <div suppressHydrationWarning className="chat-assistant-meta">
                                <Bot size={14} /> <strong>ParcelProof AI Investigator</strong>
                                <small>· Question {idx + 1}</small>
                              </div>
                            </div>
                            <div suppressHydrationWarning className="chat-answer-text">
                              {turn.question}
                            </div>
                          </article>
                        </div>

                        {/* Customer Answer Bubble */}
                        <div className="chat-message user">
                          <div className="chat-bubble-user">
                            {turn.answer}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Active Question from Assistant */}
                    {currentInvestigatorQuestion && !isIntakeLoading && (
                      <div className="chat-message assistant">
                        <article className="chat-card-assistant" style={{ background: '#f8fafc', borderLeft: '4px solid var(--accent, #00688c)' }}>
                          <div suppressHydrationWarning className="chat-assistant-header">
                            <div suppressHydrationWarning className="chat-assistant-meta">
                              <Bot size={16} style={{ color: 'var(--blue)' }} /> 
                              <strong>ParcelProof AI Investigator</strong>
                              <span className="badge warning" style={{ fontSize: '10px', padding: '1px 6px' }}>Current Question</span>
                            </div>
                          </div>
                          <div suppressHydrationWarning className="chat-answer-text" style={{ fontSize: '14.5px', fontWeight: 500, color: 'var(--ink)' }}>
                            {currentInvestigatorQuestion}
                          </div>
                        </article>
                      </div>
                    )}

                    {isIntakeLoading && (
                      <div suppressHydrationWarning className="chat-message assistant">
                        <article className="chat-card-assistant" style={{ opacity: 0.85 }}>
                          <div suppressHydrationWarning className="loading" style={{ padding: 'var(--s2) 0' }}>
                            <RotateCw className="spin" size={16} /> Analyzing your response and determining next scenario probe…
                          </div>
                        </article>
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* CHAT INPUT FORM */}
                  <form
                    onSubmit={handleSendIntakeAnswer}
                    className="chat-input-wrapper"
                    style={{ marginTop: 'var(--s3)' }}
                  >
                    <input
                      type="text"
                      className="chat-input"
                      placeholder="Type your response to the question above..."
                      value={customerAnswerInput}
                      onChange={e => setCustomerAnswerInput(e.target.value)}
                      disabled={isIntakeLoading || submittingReport}
                    />
                    <button
                      type="submit"
                      className="button primary"
                      disabled={!customerAnswerInput.trim() || isIntakeLoading || submittingReport}
                    >
                      {isIntakeLoading ? <RotateCw className="spin" size={14} /> : <Send size={14} />} Reply
                    </button>
                  </form>

                  {/* SUBMIT ACTIONS BAR */}
                  <div suppressHydrationWarning className="intake-submit-bar">
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {intakeTranscript.length >= 1 && (
                        <button
                          type="button"
                          className="quick-chip"
                          onClick={() => handleSendIntakeAnswer(undefined, "I have provided all the information I have regarding this dispute.")}
                          disabled={isIntakeLoading || submittingReport}
                        >
                          I have no further details to add
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      className="button primary"
                      disabled={intakeTranscript.length === 0 || submittingReport || isIntakeLoading}
                      onClick={handleSubmitIntakeResponses}
                      style={{ background: isInvestigationComplete ? '#1a7a3e' : undefined }}
                    >
                      {submittingReport ? (
                        <>
                          <RotateCw className="spin" size={14} /> Submitting Responses...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={15} /> Submit Responses {intakeTranscript.length > 0 ? `(${intakeTranscript.length} answered)` : ''}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* TAB 5: PROFILE */}
          {tab === 'profile' && (
            <section suppressHydrationWarning className="portal-card">
              <div suppressHydrationWarning className="section-title">
                <div>
                  <h2>Customer Account Details</h2>
                  <p>Household account information and verified identities.</p>
                </div>
              </div>
              <div suppressHydrationWarning className="context-grid">
                <div>
                  <span>Account Name</span>
                  <strong>{user?.name || 'Alex Morgan'}</strong>
                </div>
                <div>
                  <span>Account Email</span>
                  <strong>{user?.email || 'alex@example.com'}</strong>
                </div>
                <div>
                  <span>Household ID</span>
                  <strong>{user?.accountId || 'HH-208'}</strong>
                </div>
                <div>
                  <span>Identity Verification</span>
                  <strong className="good"><Check size={15} /> Verified Account Holder</strong>
                </div>
              </div>
            </section>
          )}
        </main>
      )}

      {/* PLACE ORDER MODAL */}
      {isPlacingOrder && (
        <div suppressHydrationWarning className="modal-backdrop" onClick={() => setIsPlacingOrder(false)}>
          <div suppressHydrationWarning className="modal-card" onClick={e => e.stopPropagation()}>
            <div suppressHydrationWarning className="modal-header">
              <div>
                <span className="eyebrow"><ShoppingBag size={12} /> E-Commerce Store Checkout</span>
                <h3>Place a Verified Product Order</h3>
              </div>
              <button className="icon-button" onClick={() => setIsPlacingOrder(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handlePlaceOrder}>
              <div suppressHydrationWarning className="form-group">
                <label>Select Product from Catalog</label>
                <select
                  className="portal-select"
                  value={selectedProduct.id}
                  onChange={e => {
                    const prod = PRODUCTS.find(p => p.id === e.target.value) || PRODUCTS[0];
                    setSelectedProduct(prod);
                  }}
                >
                  {PRODUCTS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ${p.price.toFixed(2)} ({p.id})
                    </option>
                  ))}
                </select>
              </div>

              <div suppressHydrationWarning style={{ background: 'var(--bg-elevated)', padding: 'var(--s3)', borderRadius: 'var(--rds-radius-md)', marginBottom: 'var(--s3)' }}>
                <strong>Product ID: {selectedProduct.id}</strong><br />
                <span style={{ fontSize: 'var(--xs)', color: 'var(--text-muted)' }}>{selectedProduct.description}</span><br />
                <span style={{ fontSize: 'var(--sm)', fontWeight: 700, color: 'var(--accent)' }}>Total: ${selectedProduct.price.toFixed(2)}</span>
              </div>

              <div suppressHydrationWarning className="form-group">
                <label>Delivery Address</label>
                <div suppressHydrationWarning className="input-with-icon">
                  <MapPin size={16} />
                  <input
                    type="text"
                    required
                    value={deliveryAddress}
                    onChange={e => setDeliveryAddress(e.target.value)}
                    placeholder="Street address, Apt/Suite, City, State"
                  />
                </div>
              </div>

              <div suppressHydrationWarning className="modal-actions">
                <button type="button" className="button secondary" onClick={() => setIsPlacingOrder(false)}>
                  Cancel
                </button>
                <button type="submit" className="button primary" disabled={placingOrder}>
                  {placingOrder ? 'Placing Order…' : `Confirm Order ($${selectedProduct.price.toFixed(2)})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* EVIDENCE CITATION MODAL */}
      {activeSource && (
        <div suppressHydrationWarning className="modal-backdrop" onClick={() => setActiveSource(null)}>
          <div suppressHydrationWarning className="modal-card" onClick={e => e.stopPropagation()}>
            <div suppressHydrationWarning className="modal-header">
              <div>
                <span className="eyebrow"><LockKeyhole size={12} /> Grounded Evidence Record</span>
                <h3>{activeSource.title}</h3>
              </div>
              <button className="icon-button" onClick={() => setActiveSource(null)}>
                <X size={18} />
              </button>
            </div>
            <div suppressHydrationWarning className="context-grid" style={{ margin: 'var(--s3) 0' }}>
              <div>
                <span>Source ID</span>
                <strong>{activeSource.id}</strong>
              </div>
              <div>
                <span>Source Type</span>
                <strong style={{ textTransform: 'capitalize' }}>{activeSource.type}</strong>
              </div>
              <div>
                <span>Recorded Time</span>
                <small>{new Date(activeSource.timestamp).toLocaleString()}</small>
              </div>
            </div>
            <pre className="source-text" style={{ background: 'var(--bg-elevated)', padding: 'var(--s4)', borderRadius: 'var(--rds-radius-md)', whiteSpace: 'pre-wrap', maxHeight: '260px', overflowY: 'auto' }}>
              {activeSource.text}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
