import { useState, useEffect, useRef } from 'react';
import { api, EnrichedTenant, TenantPlan, TenantStatus, TenantDetail, Plan, KnowledgeDocument } from '../services/api';

function Tenants() {
  const [tenants, setTenants] = useState<EnrichedTenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Detail view state
  const [selectedDetail, setSelectedDetail] = useState<TenantDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'general' | 'stats' | 'widget' | 'ai' | 'knowledge' | 'integration'>('general');
  const [widgetSubTab, setWidgetSubTab] = useState<'appearance' | 'content' | 'features' | 'questions' | 'promo'>('appearance');
  const [detailForm, setDetailForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Knowledge state
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocument[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeTab, setKnowledgeTab] = useState<'documents' | 'add'>('documents');
  const [knowledgeAddMode, setKnowledgeAddMode] = useState<'text' | 'file'>('text');
  const [knowledgeTitle, setKnowledgeTitle] = useState('');
  const [knowledgeContent, setKnowledgeContent] = useState('');
  const [knowledgeSubmitting, setKnowledgeSubmitting] = useState(false);
  const knowledgeFileRef = useRef<HTMLInputElement>(null);

  // Create form state
  const [createForm, setCreateForm] = useState({
    shop_domain: '',
    shop_name: '',
    shop_email: '',
    plan: 'starter' as TenantPlan,
    access_token: '',
    platform: 'shopify',
    chatbot_endpoint: '',
    widget_brand_name: '',
  });

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    loadTenants();
  }, [page]);

  const loadPlans = async () => {
    try {
      const data = await api.getPlans();
      setPlans(data);
    } catch (err) {
      // Plans will fall back to empty — dropdowns show nothing until loaded
    }
  };

  const loadTenants = async () => {
    try {
      setLoading(true);
      const result = await api.getTenants({ page, limit: pageSize });
      setTenants(result.tenants);
      setTotalPages(Math.ceil(result.total / pageSize));
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  const loadTenantDetail = async (shopDomain: string) => {
    try {
      setDetailLoading(true);
      setError(null);
      const detail = await api.getTenantDetail(shopDomain);
      setSelectedDetail(detail);
      setDetailForm({
        shop_name: detail.tenant.shop_name || '',
        shop_email: detail.tenant.shop_email || '',
        plan: detail.tenant.plan,
        features: { ...(detail.tenant.features || {}) },
        chatbot_endpoint: detail.clientStore?.chatbot_endpoint || '',
        widget_enabled: detail.clientStore?.widget_enabled ?? true,
        widget_color: detail.clientStore?.widget_color || '#a59457',
        widget_secondary_color: detail.clientStore?.widget_secondary_color || '#212120',
        widget_accent_color: detail.clientStore?.widget_accent_color || '#cf795e',
        widget_position: detail.clientStore?.widget_position || 'bottom-right',
        widget_button_size: detail.clientStore?.widget_button_size || 72,
        widget_button_style: detail.clientStore?.widget_button_style || 'circle',
        widget_show_pulse: detail.clientStore?.widget_show_pulse ?? true,
        widget_chat_width: detail.clientStore?.widget_chat_width || 420,
        widget_chat_height: detail.clientStore?.widget_chat_height || 600,
        widget_subtitle: detail.clientStore?.widget_subtitle || '',
        widget_placeholder: detail.clientStore?.widget_placeholder || '',
        widget_avatar: detail.clientStore?.widget_avatar || '',
        widget_show_promo_message: detail.clientStore?.widget_show_promo_message ?? true,
        widget_show_cart: detail.clientStore?.widget_show_cart ?? true,
        widget_show_contact: detail.clientStore?.widget_show_contact ?? false,
        retell_agent_id: detail.clientStore?.retell_agent_id || '',
        retell_from_number: detail.clientStore?.retell_from_number || '',
        widget_enable_animations: detail.clientStore?.widget_enable_animations ?? true,
        widget_theme: detail.clientStore?.widget_theme || 'light',
        widget_brand_name: detail.clientStore?.widget_brand_name || '',
        welcome_message: detail.clientStore?.welcome_message || '',
        widget_rotating_messages_enabled: detail.clientStore?.widget_rotating_messages_enabled ?? false,
        widget_welcome_message_2: detail.clientStore?.widget_welcome_message_2 || '',
        widget_welcome_message_3: detail.clientStore?.widget_welcome_message_3 || '',
        widget_rotating_messages_interval: detail.clientStore?.widget_rotating_messages_interval || 5,
        widget_subtitle_2: detail.clientStore?.widget_subtitle_2 || '',
        widget_subtitle_3: detail.clientStore?.widget_subtitle_3 || '',
        suggested_question_1_text: detail.clientStore?.suggested_question_1_text || '',
        suggested_question_1_message: detail.clientStore?.suggested_question_1_message || '',
        suggested_question_2_text: detail.clientStore?.suggested_question_2_text || '',
        suggested_question_2_message: detail.clientStore?.suggested_question_2_message || '',
        suggested_question_3_text: detail.clientStore?.suggested_question_3_text || '',
        suggested_question_3_message: detail.clientStore?.suggested_question_3_message || '',
        promo_badge_enabled: detail.clientStore?.promo_badge_enabled ?? false,
        promo_badge_discount: detail.clientStore?.promo_badge_discount || 10,
        promo_badge_text: detail.clientStore?.promo_badge_text || '',
        promo_badge_color: detail.clientStore?.promo_badge_color || '#ef4444',
        promo_badge_shape: detail.clientStore?.promo_badge_shape || 'circle',
        promo_badge_position: detail.clientStore?.promo_badge_position || 'right',
        promo_badge_type: detail.clientStore?.promo_badge_type || 'discount',
        chat_mode: detail.clientStore?.chat_mode || 'internal',
        ai_model: detail.clientStore?.ai_model || 'gpt-4.1-mini',
        agent_name: detail.clientStore?.agent_name || '',
        agent_tone: detail.clientStore?.agent_tone || 'friendly',
        brand_description: detail.clientStore?.brand_description || '',
        agent_instructions: detail.clientStore?.agent_instructions || '',
        agent_language: detail.clientStore?.agent_language || 'es',
      });
      setViewMode('detail');
      setActiveDetailTab('general');
      setWidgetSubTab('appearance');
    } catch (err: any) {
      setError(err.message || 'Error al cargar detalle del cliente');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveDetail = async () => {
    if (!selectedDetail) return;
    try {
      setSaving(true);
      setError(null);
      await api.updateTenant(selectedDetail.tenant.shop_domain, detailForm);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await loadTenantDetail(selectedDetail.tenant.shop_domain);
    } catch (err: any) {
      setError(err.message || 'Error al guardar cambios');
    } finally {
      setSaving(false);
    }
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedDetail(null);
    loadTenants();
  };

  const handleCreateTenant = async () => {
    try {
      setError(null);
      await api.createTenant({
        shop_domain: createForm.shop_domain,
        shop_name: createForm.shop_name,
        shop_email: createForm.shop_email,
        plan: createForm.plan,
        access_token: createForm.access_token,
        platform: createForm.platform,
        chatbot_endpoint: createForm.chatbot_endpoint || undefined,
        widget_brand_name: createForm.widget_brand_name || undefined,
      });
      setShowCreateModal(false);
      resetCreateForm();
      loadTenants();
    } catch (err: any) {
      setError(err.message || 'Error al crear cliente');
    }
  };

  const handleSuspendTenant = async (shopDomain: string) => {
    if (!confirm('Seguro que deseas suspender este cliente?')) return;
    try {
      await api.updateTenantStatus(shopDomain, 'suspended');
      if (viewMode === 'detail') {
        await loadTenantDetail(shopDomain);
      } else {
        loadTenants();
      }
    } catch (err: any) {
      setError(err.message || 'Error al suspender cliente');
    }
  };

  const handleActivateTenant = async (shopDomain: string) => {
    try {
      await api.updateTenantStatus(shopDomain, 'active');
      if (viewMode === 'detail') {
        await loadTenantDetail(shopDomain);
      } else {
        loadTenants();
      }
    } catch (err: any) {
      setError(err.message || 'Error al activar cliente');
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      shop_domain: '',
      shop_name: '',
      shop_email: '',
      plan: 'starter',
      access_token: '',
      platform: 'shopify',
      chatbot_endpoint: '',
      widget_brand_name: '',
    });
  };

  const updateDetailForm = (field: string, value: any) => {
    setDetailForm(prev => ({ ...prev, [field]: value }));
  };

  const updateFeature = (key: string, value: boolean) => {
    setDetailForm(prev => ({
      ...prev,
      features: { ...prev.features, [key]: value },
    }));
  };

  // --- Knowledge helpers ---
  const loadKnowledgeDocs = async (shopDomain: string) => {
    try {
      setKnowledgeLoading(true);
      const docs = await api.getAdminKnowledgeDocuments(shopDomain);
      setKnowledgeDocs(docs);
    } catch (err: any) {
      setError(err.message || 'Error al cargar documentos');
    } finally {
      setKnowledgeLoading(false);
    }
  };

  const handleCreateKnowledgeText = async () => {
    if (!selectedDetail || !knowledgeTitle.trim() || !knowledgeContent.trim()) return;
    try {
      setKnowledgeSubmitting(true);
      await api.createAdminKnowledgeDocument(selectedDetail.tenant.shop_domain, {
        title: knowledgeTitle,
        content: knowledgeContent,
      });
      setKnowledgeTitle('');
      setKnowledgeContent('');
      setKnowledgeTab('documents');
      await loadKnowledgeDocs(selectedDetail.tenant.shop_domain);
    } catch (err: any) {
      setError(err.message || 'Error al crear documento');
    } finally {
      setKnowledgeSubmitting(false);
    }
  };

  const handleUploadKnowledgeFile = async () => {
    if (!selectedDetail) return;
    const file = knowledgeFileRef.current?.files?.[0];
    if (!file) return;
    try {
      setKnowledgeSubmitting(true);
      await api.uploadAdminKnowledgeFile(
        selectedDetail.tenant.shop_domain,
        file,
        knowledgeTitle || undefined
      );
      setKnowledgeTitle('');
      if (knowledgeFileRef.current) knowledgeFileRef.current.value = '';
      setKnowledgeTab('documents');
      await loadKnowledgeDocs(selectedDetail.tenant.shop_domain);
    } catch (err: any) {
      setError(err.message || 'Error al subir archivo');
    } finally {
      setKnowledgeSubmitting(false);
    }
  };

  const handleDeleteKnowledgeDoc = async (docId: string) => {
    if (!selectedDetail || !confirm('Seguro que deseas eliminar este documento?')) return;
    try {
      await api.deleteAdminKnowledgeDocument(selectedDetail.tenant.shop_domain, docId);
      await loadKnowledgeDocs(selectedDetail.tenant.shop_domain);
    } catch (err: any) {
      setError(err.message || 'Error al eliminar documento');
    }
  };

  // Lazy-load knowledge docs when tab is selected
  useEffect(() => {
    if (activeDetailTab === 'knowledge' && selectedDetail && knowledgeDocs.length === 0) {
      loadKnowledgeDocs(selectedDetail.tenant.shop_domain);
    }
  }, [activeDetailTab, selectedDetail]);

  // Poll for pending/processing knowledge docs
  useEffect(() => {
    if (activeDetailTab !== 'knowledge' || !selectedDetail) return;
    const hasPending = knowledgeDocs.some(d => d.embedding_status === 'pending' || d.embedding_status === 'processing');
    if (!hasPending) return;

    const interval = setInterval(() => {
      loadKnowledgeDocs(selectedDetail.tenant.shop_domain);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeDetailTab, selectedDetail, knowledgeDocs]);

  // --- Badge helpers ---
  const getPlanBadge = (planSlug: TenantPlan) => {
    const plan = plans.find(p => p.slug === planSlug);
    const badgeClass = plan ? `badge-${plan.badge_color}` : 'badge-neutral';
    const label = plan ? plan.name : planSlug;
    return <span className={`badge ${badgeClass}`}>{label}</span>;
  };

  const getStatusBadge = (status: TenantStatus) => {
    const badges: Record<TenantStatus, string> = { active: 'badge-success', trial: 'badge-warning', suspended: 'badge-error', cancelled: 'badge-neutral' };
    const labels: Record<TenantStatus, string> = { active: 'Activo', trial: 'Prueba', suspended: 'Suspendido', cancelled: 'Cancelado' };
    return <span className={`badge ${badges[status]}`}>{labels[status]}</span>;
  };

  const getPlatformBadge = (platform?: string) => {
    if (platform === 'woocommerce') return <span className="badge" style={{ background: '#f3e8ff', color: '#7f54b3', fontWeight: 600 }}>WooCommerce</span>;
    return <span className="badge" style={{ background: '#e6f4d7', color: '#5e8e3e', fontWeight: 600 }}>Shopify</span>;
  };

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  };

  const getProgressColor = (percentage: number) => {
    if (percentage > 80) return 'error';
    if (percentage > 60) return 'warning';
    return 'primary';
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
  const formatCurrency = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
  const formatLimit = (n: number) => n === -1 ? 'Ilimitado' : n.toLocaleString();

  // --- RENDER ---

  // Detail view
  if (viewMode === 'detail') {
    if (detailLoading) {
      return (
        <>
          <header className="page-header">
            <div className="page-header-content">
              <div><h1 className="page-title">Detalle del Cliente</h1></div>
            </div>
          </header>
          <div className="page-content">
            <div className="loading-container"><div className="loading-spinner"></div><span className="loading-text">Cargando detalle...</span></div>
          </div>
        </>
      );
    }

    if (!selectedDetail) {
      return (
        <div className="page-content">
          <button className="btn btn-secondary" onClick={handleBackToList}>Volver a lista</button>
          <p style={{ marginTop: '1rem' }}>No se pudo cargar el detalle.</p>
        </div>
      );
    }

    const { tenant, clientStore, linkedUser, store, stats } = selectedDetail;

    return (
      <>
        <header className="page-header">
          <div className="page-header-content">
            <div>
              <button className="btn btn-secondary btn-sm" onClick={handleBackToList} style={{ marginBottom: '0.5rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                Volver
              </button>
              <h1 className="page-title">{tenant.shop_name || tenant.shop_domain}</h1>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
                {getPlanBadge(tenant.plan)}
                {getStatusBadge(tenant.status)}
                {getPlatformBadge(clientStore?.platform || store?.platform)}
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{tenant.shop_domain}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {success && <span style={{ color: 'var(--color-success)', fontSize: '0.9rem', fontWeight: 600 }}>Guardado</span>}
              <button className="btn btn-primary" onClick={handleSaveDetail} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </header>

        <div className="page-content">
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              <div className="alert-content"><div className="alert-message">{error}</div></div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {([['general', 'General'], ['stats', 'Uso y Stats'], ['widget', 'Widget'], ['ai', 'IA'], ['knowledge', 'Knowledge'], ['integration', 'Integracion']] as const).map(([key, label]) => (
              <button key={key} className={`btn ${activeDetailTab === key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveDetailTab(key as any)}>
                {label}
              </button>
            ))}
          </div>

          {/* TAB: General */}
          {activeDetailTab === 'general' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {/* Billing Card — full width */}
              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <div className="card-header"><h3 className="card-title">Facturacion</h3></div>
                {tenant.stripe_customer_id ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Estado Suscripcion</div>
                        <div>{tenant.stripe_subscription_id
                          ? (() => {
                              const statusMap: Record<string, { label: string; cls: string }> = {
                                active: { label: 'Activa', cls: 'badge-success' },
                                trial: { label: 'Periodo de Prueba', cls: 'badge-warning' },
                                suspended: { label: 'Pago Pendiente', cls: 'badge-error' },
                                cancelled: { label: 'Cancelada', cls: 'badge-neutral' },
                              };
                              const s = statusMap[tenant.status] || { label: tenant.status, cls: 'badge-neutral' };
                              return <span className={`badge ${s.cls}`}>{s.label}</span>;
                            })()
                          : <span className="badge badge-neutral">Sin suscripcion</span>
                        }</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Plan</div>
                        <div>{getPlanBadge(tenant.plan)}</div>
                      </div>
                      {(() => {
                        const planData = plans.find(p => p.slug === tenant.plan);
                        return planData && planData.price > 0 ? (
                          <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Precio</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>${planData.price}<span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--color-text-muted)' }}>/mes</span></div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Email de Facturacion</div>
                        <div style={{ fontSize: '0.9rem' }}>{tenant.billing_email || tenant.shop_email || '-'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Stripe Customer</div>
                        <a href={`https://dashboard.stripe.com/customers/${tenant.stripe_customer_id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', color: 'var(--color-primary)', textDecoration: 'none' }}>
                          {tenant.stripe_customer_id}
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 4, verticalAlign: 'middle' }}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                        </a>
                      </div>
                      {tenant.stripe_subscription_id && (
                        <div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Stripe Subscription</div>
                          <a href={`https://dashboard.stripe.com/subscriptions/${tenant.stripe_subscription_id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', color: 'var(--color-primary)', textDecoration: 'none' }}>
                            {tenant.stripe_subscription_id}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 4, verticalAlign: 'middle' }}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                          </a>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {tenant.trial_ends_at && (
                        <div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Fin del Trial</div>
                          <div style={{ fontSize: '0.9rem' }}>{formatDate(tenant.trial_ends_at)}</div>
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Creado</div>
                        <div style={{ fontSize: '0.9rem' }}>{formatDate(tenant.created_at)}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 0' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Sin informacion de pago</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Este cliente no tiene un metodo de pago configurado en Stripe</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="card">
                <div className="card-header"><h3 className="card-title">Informacion del Cliente</h3></div>
                <div className="form-group">
                  <label className="form-label">Nombre de la Tienda</label>
                  <input type="text" className="form-input" value={detailForm.shop_name} onChange={e => updateDetailForm('shop_name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={detailForm.shop_email} onChange={e => updateDetailForm('shop_email', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Plan</label>
                  <select className="form-select" value={detailForm.plan} onChange={e => updateDetailForm('plan', e.target.value)}>
                    {plans.map(p => (
                      <option key={p.slug} value={p.slug}>{p.name} - {formatLimit(p.monthly_messages)} msgs/mes</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {getStatusBadge(tenant.status)}
                    {(tenant.status === 'active' || tenant.status === 'trial') && (
                      <button className="btn btn-danger btn-sm" onClick={() => handleSuspendTenant(tenant.shop_domain)}>Suspender</button>
                    )}
                    {(tenant.status === 'suspended' || tenant.status === 'cancelled') && (
                      <button className="btn btn-secondary btn-sm" onClick={() => handleActivateTenant(tenant.shop_domain)}>Activar</button>
                    )}
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header"><h3 className="card-title">Usuario Vinculado</h3></div>
                {linkedUser ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Nombre</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{linkedUser.first_name} {linkedUser.last_name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Email</span>
                      <span style={{ fontSize: '0.9rem' }}>{linkedUser.email}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Empresa</span>
                      <span style={{ fontSize: '0.9rem' }}>{linkedUser.company || '-'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Tipo</span>
                      <span className="badge badge-primary">{linkedUser.user_type}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Ultimo Login</span>
                      <span style={{ fontSize: '0.9rem' }}>{formatDate(linkedUser.last_login_at)}</span>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Sin usuario vinculado</p>
                )}

                <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '1rem', paddingTop: '1rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>Fechas</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Creado</span>
                      <span style={{ fontSize: '0.85rem' }}>{formatDate(tenant.created_at)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Actualizado</span>
                      <span style={{ fontSize: '0.85rem' }}>{formatDate(tenant.updated_at)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Ultima Actividad</span>
                      <span style={{ fontSize: '0.85rem' }}>{formatDate(tenant.last_activity_at)}</span>
                    </div>
                    {tenant.trial_ends_at && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Trial Expira</span>
                        <span style={{ fontSize: '0.85rem' }}>{formatDate(tenant.trial_ends_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Stats */}
          {activeDetailTab === 'stats' && (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon primary">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  </div>
                  <div className="stat-value">{stats.totalMessages.toLocaleString()}</div>
                  <div className="stat-label">Total Mensajes</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon success">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                  </div>
                  <div className="stat-value">{stats.uniqueSessions.toLocaleString()}</div>
                  <div className="stat-label">Sesiones Unicas</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon warning">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10M18 20V4M6 20v-4" /></svg>
                  </div>
                  <div className="stat-value">{stats.totalConversions.toLocaleString()}</div>
                  <div className="stat-label">Conversiones</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon accent">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                  </div>
                  <div className="stat-value">{formatCurrency(stats.totalRevenue)}</div>
                  <div className="stat-label">Revenue Total</div>
                </div>
              </div>

              <div className="card" style={{ marginTop: '1.5rem' }}>
                <div className="card-header">
                  <h3 className="card-title">Uso del Plan</h3>
                </div>
                {(() => {
                  const detailPlan = plans.find(p => p.slug === tenant.plan);
                  const msgLimit = detailPlan?.monthly_messages ?? 100;
                  const prodLimit = detailPlan?.products_limit ?? 50;
                  return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Mensajes este mes</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                      {(stats.monthlyMessages || 0).toLocaleString()} / {msgLimit === -1 ? 'Ilimitado' : msgLimit.toLocaleString()}
                    </div>
                    {msgLimit !== -1 && (() => {
                      const pct = getUsagePercentage(stats.monthlyMessages || 0, msgLimit);
                      return (
                        <div className="progress-bar">
                          <div className={`progress-bar-fill ${getProgressColor(pct)}`} style={{ width: `${pct}%` }}></div>
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Productos</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{clientStore?.products_synced || 0} sincronizados</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                      Limite: {prodLimit === -1 ? 'Ilimitado' : prodLimit.toLocaleString()}
                    </div>
                    {clientStore?.last_sync_at && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                        Ultimo sync: {formatDate(clientStore.last_sync_at)}
                      </div>
                    )}
                  </div>
                </div>
                  );
                })()}
              </div>
            </>
          )}

          {/* TAB: Widget */}
          {activeDetailTab === 'widget' && (
            <>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {([['appearance', 'Apariencia'], ['content', 'Contenido'], ['features', 'Funcionalidades'], ['questions', 'Preguntas'], ['promo', 'Promo Badge']] as const).map(([key, label]) => (
                  <button key={key} className={`btn btn-sm ${widgetSubTab === key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setWidgetSubTab(key as any)}>
                    {label}
                  </button>
                ))}
              </div>

              {!clientStore ? (
                <div className="card"><p style={{ color: 'var(--color-text-muted)' }}>No hay configuracion de widget para este cliente. Se creara al guardar cambios.</p></div>
              ) : (
                <>
                  {/* Widget: Appearance */}
                  {widgetSubTab === 'appearance' && (
                    <div className="card">
                      <div className="form-group">
                        <label className="form-label">Tema</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className={`btn btn-sm ${detailForm.widget_theme === 'light' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => updateDetailForm('widget_theme', 'light')}>Claro</button>
                          <button className={`btn btn-sm ${detailForm.widget_theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => updateDetailForm('widget_theme', 'dark')}>Oscuro</button>
                        </div>
                      </div>
                      {[['widget_color', 'Color Primario'], ['widget_secondary_color', 'Color Secundario'], ['widget_accent_color', 'Color Acento']].map(([field, label]) => (
                        <div className="form-group" key={field}>
                          <label className="form-label">{label}</label>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input type="color" value={detailForm[field] || '#000000'} onChange={e => updateDetailForm(field, e.target.value)} style={{ width: 40, height: 40, border: 'none', cursor: 'pointer', borderRadius: 8 }} />
                            <input type="text" className="form-input" value={detailForm[field] || ''} onChange={e => updateDetailForm(field, e.target.value)} style={{ maxWidth: 140 }} />
                          </div>
                        </div>
                      ))}
                      <div className="form-group">
                        <label className="form-label">Posicion</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', maxWidth: 300 }}>
                          {['bottom-right', 'bottom-left', 'top-right', 'top-left'].map(pos => (
                            <button key={pos} className={`btn btn-sm ${detailForm.widget_position === pos ? 'btn-primary' : 'btn-secondary'}`} onClick={() => updateDetailForm('widget_position', pos)}>
                              {pos.replace('-', ' ')}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Estilo del Boton</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {['circle', 'rounded', 'square'].map(s => (
                            <button key={s} className={`btn btn-sm ${detailForm.widget_button_style === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => updateDetailForm('widget_button_style', s)}>
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Tamano del Boton: {detailForm.widget_button_size}px</label>
                        <input type="range" min="48" max="96" value={detailForm.widget_button_size} onChange={e => updateDetailForm('widget_button_size', parseInt(e.target.value))} style={{ width: '100%' }} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Ancho del Chat: {detailForm.widget_chat_width}px</label>
                        <input type="range" min="320" max="600" step="10" value={detailForm.widget_chat_width} onChange={e => updateDetailForm('widget_chat_width', parseInt(e.target.value))} style={{ width: '100%' }} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Alto del Chat: {detailForm.widget_chat_height}px</label>
                        <input type="range" min="400" max="800" step="10" value={detailForm.widget_chat_height} onChange={e => updateDetailForm('widget_chat_height', parseInt(e.target.value))} style={{ width: '100%' }} />
                      </div>
                    </div>
                  )}

                  {/* Widget: Content */}
                  {widgetSubTab === 'content' && (
                    <div className="card">
                      <div className="form-group">
                        <label className="form-label">Nombre de Marca</label>
                        <input type="text" className="form-input" value={detailForm.widget_brand_name} onChange={e => updateDetailForm('widget_brand_name', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Avatar</label>
                        <input type="text" className="form-input" value={detailForm.widget_avatar} onChange={e => updateDetailForm('widget_avatar', e.target.value)} maxLength={4} style={{ maxWidth: 100 }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Emoji o texto corto</span>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Mensaje de Bienvenida</label>
                        <textarea className="form-input" rows={2} value={detailForm.welcome_message} onChange={e => updateDetailForm('welcome_message', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Subtitulo</label>
                        <input type="text" className="form-input" value={detailForm.widget_subtitle} onChange={e => updateDetailForm('widget_subtitle', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Placeholder</label>
                        <input type="text" className="form-input" value={detailForm.widget_placeholder} onChange={e => updateDetailForm('widget_placeholder', e.target.value)} />
                      </div>
                      <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '1rem', paddingTop: '1rem' }}>
                        <div className="form-group">
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={detailForm.widget_rotating_messages_enabled} onChange={e => updateDetailForm('widget_rotating_messages_enabled', e.target.checked)} style={{ width: 18, height: 18 }} />
                            <span className="form-label" style={{ margin: 0 }}>Mensajes Rotativos</span>
                          </label>
                        </div>
                        {detailForm.widget_rotating_messages_enabled && (
                          <>
                            <div className="form-group">
                              <label className="form-label">Intervalo (segundos)</label>
                              <input type="number" className="form-input" value={detailForm.widget_rotating_messages_interval} onChange={e => updateDetailForm('widget_rotating_messages_interval', parseInt(e.target.value))} style={{ maxWidth: 100 }} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Mensaje 2</label>
                              <input type="text" className="form-input" value={detailForm.widget_welcome_message_2} onChange={e => updateDetailForm('widget_welcome_message_2', e.target.value)} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Subtitulo 2</label>
                              <input type="text" className="form-input" value={detailForm.widget_subtitle_2} onChange={e => updateDetailForm('widget_subtitle_2', e.target.value)} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Mensaje 3</label>
                              <input type="text" className="form-input" value={detailForm.widget_welcome_message_3} onChange={e => updateDetailForm('widget_welcome_message_3', e.target.value)} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Subtitulo 3</label>
                              <input type="text" className="form-input" value={detailForm.widget_subtitle_3} onChange={e => updateDetailForm('widget_subtitle_3', e.target.value)} />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Widget: Features */}
                  {widgetSubTab === 'features' && (
                    <div className="card">
                      {[
                        ['widget_show_pulse', 'Animacion Pulse', 'Muestra efecto pulse en el boton del chat'],
                        ['widget_show_promo_message', 'Mensaje Promocional', 'Muestra un mensaje promocional junto al boton'],
                        ['widget_show_cart', 'Carrito Integrado', 'Permite gestionar el carrito desde el chat'],
                        ['widget_show_contact', 'Contacto Telefonico', 'Solicitar llamada desde el chat'],
                        ['widget_enable_animations', 'Animaciones', 'Habilita animaciones en el widget'],
                        ['widget_enabled', 'Widget Activo', 'El widget esta visible en la tienda'],
                      ].map(([field, label, desc]) => (
                        <div className="form-group" key={field}>
                          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={detailForm[field] ?? (field === 'widget_show_contact' ? false : true)} onChange={e => updateDetailForm(field, e.target.checked)} style={{ width: 20, height: 20, marginTop: 2 }} />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{desc}</div>
                            </div>
                          </label>
                          {field === 'widget_show_contact' && detailForm.widget_show_contact && (
                            <div style={{ marginTop: '0.5rem', paddingLeft: '2.5rem' }}>
                              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Retell Agent ID</div>
                              <input type="text" className="form-input" value={detailForm.retell_agent_id || ''} onChange={e => updateDetailForm('retell_agent_id', e.target.value)} placeholder="agent_xxxxxxxxxxxxxxxx" />
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>ID del agente en Retell AI</div>
                              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', marginTop: '0.5rem' }}>Retell From Number</div>
                              <input type="text" className="form-input" value={detailForm.retell_from_number || ''} onChange={e => updateDetailForm('retell_from_number', e.target.value)} placeholder="+1234567890" />
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Número desde el cual se realizará la llamada</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Widget: Suggested Questions */}
                  {widgetSubTab === 'questions' && (
                    <div className="card">
                      <div className="card-header"><h3 className="card-title">Preguntas Sugeridas</h3></div>
                      {[1, 2, 3].map(n => (
                        <div key={n} style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: n < 3 ? '1px solid var(--color-border)' : 'none' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>Pregunta {n}</div>
                          <div className="form-group">
                            <label className="form-label">Texto del boton</label>
                            <input type="text" className="form-input" value={detailForm[`suggested_question_${n}_text`]} onChange={e => updateDetailForm(`suggested_question_${n}_text`, e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Mensaje que se envia</label>
                            <input type="text" className="form-input" value={detailForm[`suggested_question_${n}_message`]} onChange={e => updateDetailForm(`suggested_question_${n}_message`, e.target.value)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Widget: Promo Badge */}
                  {widgetSubTab === 'promo' && (
                    <div className="card">
                      <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={detailForm.promo_badge_enabled} onChange={e => updateDetailForm('promo_badge_enabled', e.target.checked)} style={{ width: 20, height: 20 }} />
                          <span className="form-label" style={{ margin: 0 }}>Badge Promocional Activo</span>
                        </label>
                      </div>
                      {detailForm.promo_badge_enabled && (
                        <>
                          <div className="form-group">
                            <label className="form-label">Tipo</label>
                            <select className="form-select" value={detailForm.promo_badge_type} onChange={e => updateDetailForm('promo_badge_type', e.target.value)}>
                              <option value="discount">Descuento</option>
                              <option value="text">Texto libre</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Texto</label>
                            <input type="text" className="form-input" value={detailForm.promo_badge_text} onChange={e => updateDetailForm('promo_badge_text', e.target.value)} />
                          </div>
                          {detailForm.promo_badge_type === 'discount' && (
                            <div className="form-group">
                              <label className="form-label">Descuento (%)</label>
                              <input type="number" className="form-input" value={detailForm.promo_badge_discount} onChange={e => updateDetailForm('promo_badge_discount', parseInt(e.target.value))} style={{ maxWidth: 100 }} />
                            </div>
                          )}
                          <div className="form-group">
                            <label className="form-label">Color del Badge</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input type="color" value={detailForm.promo_badge_color || '#ef4444'} onChange={e => updateDetailForm('promo_badge_color', e.target.value)} style={{ width: 40, height: 40, border: 'none', cursor: 'pointer', borderRadius: 8 }} />
                              <input type="text" className="form-input" value={detailForm.promo_badge_color} onChange={e => updateDetailForm('promo_badge_color', e.target.value)} style={{ maxWidth: 140 }} />
                            </div>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Forma</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              {['circle', 'pill', 'square'].map(s => (
                                <button key={s} className={`btn btn-sm ${detailForm.promo_badge_shape === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => updateDetailForm('promo_badge_shape', s)}>
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Posicion</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              {['left', 'right', 'top'].map(p => (
                                <button key={p} className={`btn btn-sm ${detailForm.promo_badge_position === p ? 'btn-primary' : 'btn-secondary'}`} onClick={() => updateDetailForm('promo_badge_position', p)}>
                                  {p.charAt(0).toUpperCase() + p.slice(1)}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* TAB: IA */}
          {activeDetailTab === 'ai' && (
            <div className="card">
              <div className="card-header"><h3 className="card-title">Configuracion de IA</h3></div>
              <div className="form-group">
                <label className="form-label">Modo de Chat</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button
                    className={`btn ${detailForm.chat_mode === 'internal' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => updateDetailForm('chat_mode', 'internal')}
                    style={{ padding: '1rem', height: 'auto', flexDirection: 'column', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/></svg>
                    <span style={{ fontWeight: 600 }}>IA Interna (Kova)</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Motor de IA integrado</span>
                  </button>
                  <button
                    className={`btn ${detailForm.chat_mode === 'external' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => updateDetailForm('chat_mode', 'external')}
                    style={{ padding: '1rem', height: 'auto', flexDirection: 'column', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    <span style={{ fontWeight: 600 }}>Endpoint Externo</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Webhook personalizado</span>
                  </button>
                </div>
              </div>

              {detailForm.chat_mode === 'internal' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Nombre del Agente</label>
                    <input type="text" className="form-input" placeholder="Ej: Kova" value={detailForm.agent_name} onChange={e => updateDetailForm('agent_name', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Descripcion de la Marca</label>
                    <textarea className="form-input" rows={3} placeholder="Describe la marca para darle contexto al agente..." value={detailForm.brand_description} onChange={e => updateDetailForm('brand_description', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tono del Agente</label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {[['friendly', 'Amigable'], ['formal', 'Formal'], ['casual', 'Casual'], ['professional', 'Profesional']].map(([val, label]) => (
                        <button key={val} className={`btn btn-sm ${detailForm.agent_tone === val ? 'btn-primary' : 'btn-secondary'}`} onClick={() => updateDetailForm('agent_tone', val)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Idioma del Agente</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {[['es', 'Espanol'], ['en', 'English'], ['pt', 'Portugues']].map(([val, label]) => (
                        <button key={val} className={`btn btn-sm ${detailForm.agent_language === val ? 'btn-primary' : 'btn-secondary'}`} onClick={() => updateDetailForm('agent_language', val)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Instrucciones del Agente</label>
                    <textarea className="form-input" rows={4} placeholder="Instrucciones adicionales para el comportamiento del agente..." value={detailForm.agent_instructions} onChange={e => updateDetailForm('agent_instructions', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Modelo de IA</label>
                    <select className="form-select" value={detailForm.ai_model} onChange={e => updateDetailForm('ai_model', e.target.value)}>
                      <option value="gpt-4.1-mini">GPT-4.1 Mini (Recomendado)</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-4">GPT-4</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Chatbot Endpoint (obligatorio)</label>
                    <input type="text" className="form-input" placeholder="https://n8n.example.com/webhook/..." value={detailForm.chatbot_endpoint} onChange={e => updateDetailForm('chatbot_endpoint', e.target.value)} />
                  </div>
                  <div style={{ padding: '0.75rem 1rem', background: 'var(--color-bg)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    El endpoint debe aceptar POST con <code>{'{ message, sessionId, shopDomain }'}</code> y responder con <code>{'{ reply }'}</code>.
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB: Knowledge */}
          {activeDetailTab === 'knowledge' && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Knowledge Base</h3>
              </div>

              {/* Sub-tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button className={`btn btn-sm ${knowledgeTab === 'documents' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setKnowledgeTab('documents')}>
                  Documentos ({knowledgeDocs.length})
                </button>
                <button className={`btn btn-sm ${knowledgeTab === 'add' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setKnowledgeTab('add')}>
                  + Agregar
                </button>
              </div>

              {knowledgeTab === 'documents' && (
                <>
                  {knowledgeLoading ? (
                    <div className="loading-container"><div className="loading-spinner"></div><span className="loading-text">Cargando documentos...</span></div>
                  ) : knowledgeDocs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-text-muted)' }}>
                      <p style={{ marginBottom: '0.75rem' }}>No hay documentos en la knowledge base.</p>
                      <button className="btn btn-primary btn-sm" onClick={() => setKnowledgeTab('add')}>Agregar primer documento</button>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="table" style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th>Titulo</th>
                            <th>Tipo</th>
                            <th>Fragmentos</th>
                            <th>Estado</th>
                            <th>Fecha</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {knowledgeDocs.map(doc => (
                            <tr key={doc.id}>
                              <td style={{ fontWeight: 600 }}>{doc.title}</td>
                              <td><span className="badge badge-neutral">{doc.source_type}</span></td>
                              <td>{doc.chunk_count}</td>
                              <td>
                                {doc.embedding_status === 'completed' && <span className="badge badge-success">Listo</span>}
                                {doc.embedding_status === 'processing' && <span className="badge badge-warning">Procesando</span>}
                                {doc.embedding_status === 'pending' && <span className="badge badge-neutral">Pendiente</span>}
                                {doc.embedding_status === 'failed' && <span className="badge badge-error">Error</span>}
                              </td>
                              <td style={{ color: 'var(--color-text-muted)' }}>{formatDate(doc.created_at)}</td>
                              <td>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteKnowledgeDoc(doc.id)}>Eliminar</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {knowledgeTab === 'add' && (
                <>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    <button className={`btn btn-sm ${knowledgeAddMode === 'text' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setKnowledgeAddMode('text')}>
                      Texto directo
                    </button>
                    <button className={`btn btn-sm ${knowledgeAddMode === 'file' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setKnowledgeAddMode('file')}>
                      Subir archivo
                    </button>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Titulo</label>
                    <input type="text" className="form-input" placeholder="Nombre del documento..." value={knowledgeTitle} onChange={e => setKnowledgeTitle(e.target.value)} />
                  </div>

                  {knowledgeAddMode === 'text' ? (
                    <>
                      <div className="form-group">
                        <label className="form-label">Contenido</label>
                        <textarea className="form-input" rows={8} placeholder="Pega o escribe el contenido aqui..." value={knowledgeContent} onChange={e => setKnowledgeContent(e.target.value)} />
                      </div>
                      <button className="btn btn-primary" disabled={knowledgeSubmitting || !knowledgeTitle.trim() || !knowledgeContent.trim()} onClick={handleCreateKnowledgeText}>
                        {knowledgeSubmitting ? 'Creando...' : 'Crear Documento'}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="form-group">
                        <label className="form-label">Archivo (.txt, .md, .pdf)</label>
                        <input type="file" ref={knowledgeFileRef} accept=".txt,.md,.pdf" className="form-input" />
                      </div>
                      <button className="btn btn-primary" disabled={knowledgeSubmitting} onClick={handleUploadKnowledgeFile}>
                        {knowledgeSubmitting ? 'Subiendo...' : 'Subir Archivo'}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB: Integration */}
          {activeDetailTab === 'integration' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="card">
                <div className="card-header"><h3 className="card-title">Configuracion de Integracion</h3></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: 'var(--color-bg)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Plataforma</span>
                    {getPlatformBadge(clientStore?.platform || store?.platform)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Estado Store</span>
                    <span className="badge badge-success">{clientStore?.status || store ? 'Conectado' : 'Sin conectar'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Productos Sync</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{clientStore?.products_synced || 0}</span>
                  </div>
                  {clientStore?.last_sync_at && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Ultimo Sync</span>
                      <span style={{ fontSize: '0.85rem' }}>{formatDate(clientStore.last_sync_at)}</span>
                    </div>
                  )}
                  {store?.installed_at && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Instalado</span>
                      <span style={{ fontSize: '0.85rem' }}>{formatDate(store.installed_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header"><h3 className="card-title">Feature Flags</h3></div>
                {[
                  ['semantic_search', 'Busqueda Semantica', 'Busqueda por significado con embeddings IA'],
                  ['cart_management', 'Gestion de Carrito', 'Agregar/modificar productos desde el chat'],
                  ['analytics', 'Analytics', 'Dashboard de analiticas y metricas'],
                  ['custom_branding', 'Branding Personalizado', 'Personalizar colores y marca del widget'],
                  ['priority_support', 'Soporte Prioritario', 'Atencion preferencial al cliente'],
                  ['api_access', 'Acceso API', 'Acceso directo a la API del sistema'],
                ].map(([key, label, desc]) => (
                  <div className="form-group" key={key}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={detailForm.features?.[key] ?? false} onChange={e => updateFeature(key, e.target.checked)} style={{ width: 20, height: 20, marginTop: 2 }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{desc}</div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  // --- LIST VIEW ---
  return (
    <>
      <header className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">Clientes</h1>
            <p className="page-subtitle">Gestiona los clientes de tu plataforma</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Agregar Cliente
          </button>
        </div>
      </header>

      <div className="page-content">
        {error && (
          <div className="alert alert-error">
            <div className="alert-content"><div className="alert-message">{error}</div></div>
          </div>
        )}

        <div className="table-container">
          <div className="table-header">
            <h3 className="table-title">Lista de Clientes</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{tenants.length} clientes</span>
          </div>

          {loading ? (
            <div className="loading-container"><div className="loading-spinner"></div><span className="loading-text">Cargando clientes...</span></div>
          ) : tenants.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              </div>
              <h3 className="empty-state-title">No hay clientes</h3>
              <p className="empty-state-description">Agrega tu primer cliente para comenzar</p>
              <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>Agregar primer cliente</button>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Tienda</th>
                  <th>Plataforma</th>
                  <th>Plan</th>
                  <th>Estado</th>
                  <th>Pago</th>
                  <th>Mensajes</th>
                  <th>Creado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => {
                  const planData = plans.find(p => p.slug === tenant.plan);
                  const planLimit = planData?.monthly_messages ?? 100;
                  const usagePercent = getUsagePercentage(tenant.real_message_count || 0, planLimit);
                  return (
                    <tr key={tenant.id}>
                      <td>
                        <div className="table-cell-main" style={{ cursor: 'pointer', color: 'var(--color-text)', fontWeight: 600 }} onClick={() => loadTenantDetail(tenant.shop_domain)}>
                          {tenant.shop_domain}
                        </div>
                        {tenant.shop_name && tenant.shop_name !== tenant.shop_domain && (
                          <div className="table-cell-sub">{tenant.shop_name}</div>
                        )}
                      </td>
                      <td>{getPlatformBadge(tenant.platform)}</td>
                      <td>{getPlanBadge(tenant.plan)}</td>
                      <td>{getStatusBadge(tenant.status)}</td>
                      <td>
                        {tenant.stripe_subscription_id ? (
                          <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>Stripe</span>
                        ) : tenant.stripe_customer_id ? (
                          <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>Sin sub.</span>
                        ) : (
                          <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>-</span>
                        )}
                      </td>
                      <td>
                        <div style={{ minWidth: '120px' }}>
                          <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 600 }}>{(tenant.real_message_count || 0).toLocaleString()}</span>
                            <span style={{ color: 'var(--color-text-muted)' }}> este mes</span>
                          </div>
                          <div style={{ fontSize: '0.8rem', marginBottom: '0.25rem', color: 'var(--color-text-muted)' }}>
                            Limite: {planLimit === -1 ? '\u221E' : planLimit.toLocaleString()} / mes
                          </div>
                          <div className="progress-bar">
                            <div className={`progress-bar-fill ${getProgressColor(usagePercent)}`} style={{ width: `${usagePercent}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                          {formatDate(tenant.created_at)}
                        </span>
                      </td>
                      <td>
                        <div className="actions-cell">
                          <button className="btn btn-primary btn-sm" onClick={() => loadTenantDetail(tenant.shop_domain)}>Ver</button>
                          {tenant.status === 'active' || tenant.status === 'trial' ? (
                            <button className="btn btn-danger btn-sm" onClick={() => handleSuspendTenant(tenant.shop_domain)}>Suspender</button>
                          ) : (
                            <button className="btn btn-secondary btn-sm" onClick={() => handleActivateTenant(tenant.shop_domain)}>Activar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button>
              <span style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>Pagina {page} de {totalPages}</span>
              <button className="btn btn-secondary btn-sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Siguiente</button>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Agregar Nuevo Cliente</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Plataforma</label>
                <select className="form-select" value={createForm.platform} onChange={e => setCreateForm({ ...createForm, platform: e.target.value })}>
                  <option value="shopify">Shopify</option>
                  <option value="woocommerce">WooCommerce</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{createForm.platform === 'woocommerce' ? 'Dominio del Sitio' : 'Dominio de Shopify'}</label>
                <input type="text" className="form-input" placeholder={createForm.platform === 'woocommerce' ? 'mitienda.com' : 'tienda.myshopify.com'} value={createForm.shop_domain} onChange={e => setCreateForm({ ...createForm, shop_domain: e.target.value })} />
                <p className="form-hint">{createForm.platform === 'woocommerce' ? 'El dominio del sitio WooCommerce' : 'El dominio .myshopify.com de la tienda'}</p>
              </div>
              <div className="form-group">
                <label className="form-label">Access Token</label>
                <input type="text" className="form-input" placeholder={createForm.platform === 'woocommerce' ? 'ck_xxxxx' : 'shpat_xxxxx'} value={createForm.access_token} onChange={e => setCreateForm({ ...createForm, access_token: e.target.value })} />
                <p className="form-hint">Token de acceso de la tienda</p>
              </div>
              <div className="form-group">
                <label className="form-label">Nombre de la Tienda (opcional)</label>
                <input type="text" className="form-input" placeholder="Mi Tienda" value={createForm.shop_name} onChange={e => setCreateForm({ ...createForm, shop_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Email (opcional)</label>
                <input type="email" className="form-input" placeholder="contacto@tienda.com" value={createForm.shop_email} onChange={e => setCreateForm({ ...createForm, shop_email: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Chatbot Endpoint (opcional)</label>
                <input type="text" className="form-input" placeholder="https://n8n.example.com/webhook/..." value={createForm.chatbot_endpoint} onChange={e => setCreateForm({ ...createForm, chatbot_endpoint: e.target.value })} />
                <p className="form-hint">URL del webhook del chatbot (n8n, etc.)</p>
              </div>
              <div className="form-group">
                <label className="form-label">Nombre de Marca Widget (opcional)</label>
                <input type="text" className="form-input" placeholder="Mi Marca" value={createForm.widget_brand_name} onChange={e => setCreateForm({ ...createForm, widget_brand_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Plan</label>
                <select className="form-select" value={createForm.plan} onChange={e => setCreateForm({ ...createForm, plan: e.target.value as TenantPlan })}>
                  {plans.map(p => (
                    <option key={p.slug} value={p.slug}>{p.name} - {formatLimit(p.monthly_messages)} msgs/mes</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowCreateModal(false); resetCreateForm(); }}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreateTenant}>Crear Cliente</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Tenants;
