import { useState, useEffect } from 'react';
import { clientApi, Plan } from '../../services/api';

interface BillingStatus {
  plan: string;
  status: string;
  trialEndsAt: string | null;
  subscription: {
    id: string;
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    trialEnd: string | null;
  } | null;
}

interface UsageData {
  messages_used: number;
  messages_limit: number;
  messages_remaining: number;
  usage_percentage: number;
  is_over_limit: boolean;
  products_synced: number;
  products_limit: number;
}

function Subscription() {
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [billingRes, usageRes, plansRes] = await Promise.all([
        clientApi.getBillingStatus(),
        clientApi.getUsage(),
        clientApi.getAvailablePlans(),
      ]);
      setBilling(billingRes.data);
      setUsage(usageRes.data);
      setPlans(plansRes.data || []);
    } catch (err: any) {
      console.error('Error loading subscription data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('¿Estas seguro de que deseas cancelar tu suscripcion? Podras seguir usando el servicio hasta el final del periodo de facturacion actual.')) {
      return;
    }
    try {
      setActionLoading(true);
      await clientApi.cancelSubscription();
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Error al cancelar suscripcion');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    try {
      setActionLoading(true);
      await clientApi.reactivateSubscription();
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Error al reactivar suscripcion');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePortal = async () => {
    try {
      setActionLoading(true);
      const res = await clientApi.createPortalSession();
      if (res.data?.portalUrl) {
        window.location.href = res.data.portalUrl;
      }
    } catch (err: any) {
      alert(err.message || 'Error al abrir portal de facturacion');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckout = async (planSlug: string) => {
    try {
      setActionLoading(true);
      const res = await clientApi.createCheckout(planSlug);
      if (res.data?.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
      } else if (res.data?.free) {
        window.location.reload();
      }
    } catch (err: any) {
      alert(err.message || 'Error al cambiar plan');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!billing) return { label: 'Sin suscripcion', color: 'neutral' };
    if (billing.subscription?.cancelAtPeriodEnd) return { label: 'Cancelando', color: 'warning' };
    if (billing.status === 'trial') return { label: 'Trial', color: 'primary' };
    if (billing.subscription?.status === 'active') return { label: 'Activo', color: 'success' };
    if (billing.subscription?.status === 'trialing') return { label: 'Trial', color: 'primary' };
    if (billing.plan && billing.plan !== 'free') return { label: 'Activo', color: 'success' };
    return { label: 'Sin suscripcion', color: 'neutral' };
  };

  const getCurrentPlan = (): Plan | undefined => {
    return plans.find(p => p.slug === billing?.plan);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'var(--color-error)';
    if (percentage >= 70) return 'var(--color-warning)';
    return 'var(--color-success)';
  };

  const formatFeatures = (plan: Plan): string[] => {
    const features: string[] = [];
    const msgs = plan.monthly_messages === -1 ? 'Mensajes ilimitados' : `${plan.monthly_messages.toLocaleString()} mensajes/mes`;
    const prods = plan.products_limit === -1 ? 'Productos ilimitados' : `${plan.products_limit.toLocaleString()} productos`;
    features.push(msgs, prods);
    if (plan.features.analytics) features.push('Analytics');
    if (plan.features.custom_branding) features.push('Branding personalizado');
    if (plan.features.priority_support) features.push('Soporte prioritario');
    if (plan.features.api_access) features.push('Acceso API');
    return features;
  };

  if (loading) {
    return (
      <>
        <header className="page-header">
          <div className="page-header-content">
            <div>
              <h1 className="page-title">Suscripcion</h1>
              <p className="page-subtitle">Gestiona tu plan y facturacion</p>
            </div>
          </div>
        </header>
        <div className="page-content">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <span className="loading-text">Cargando...</span>
          </div>
        </div>
      </>
    );
  }

  const statusBadge = getStatusBadge();
  const currentPlan = getCurrentPlan();

  return (
    <>
      <header className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">Suscripcion</h1>
            <p className="page-subtitle">Gestiona tu plan y facturacion</p>
          </div>
        </div>
      </header>

      <div className="page-content">
        {/* Section 1: Plan & Billing Status */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h3 className="card-title">Plan y Facturacion</h3>
            <span className={`badge badge-${statusBadge.color}`}>{statusBadge.label}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text)' }}>
                  {currentPlan?.name || (billing?.plan ? billing.plan.charAt(0).toUpperCase() + billing.plan.slice(1) : 'Free')}
                </div>
                {currentPlan && currentPlan.price > 0 && (
                  <div style={{ fontSize: '1rem', color: 'var(--color-text-secondary)' }}>
                    ${currentPlan.price}/mes
                  </div>
                )}
              </div>
            </div>

            {billing?.subscription?.cancelAtPeriodEnd && billing.subscription.currentPeriodEnd && (
              <div style={{
                padding: '0.75rem 1rem',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                color: 'var(--color-warning)',
                fontSize: '0.9rem',
              }}>
                Tu suscripcion se cancelara el {formatDate(billing.subscription.currentPeriodEnd)}. Puedes reactivarla antes de esa fecha.
              </div>
            )}

            {billing?.subscription?.currentPeriodEnd && !billing.subscription.cancelAtPeriodEnd && (
              <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                Proxima facturacion: {formatDate(billing.subscription.currentPeriodEnd)}
              </div>
            )}

            {billing?.subscription?.trialEnd && (
              <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                Trial termina: {formatDate(billing.subscription.trialEnd)}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {billing?.subscription && (
                <button
                  className="btn btn-secondary"
                  disabled={actionLoading}
                  onClick={handlePortal}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                  {actionLoading ? 'Abriendo...' : 'Gestionar Facturacion'}
                </button>
              )}

              {billing?.subscription && !billing.subscription.cancelAtPeriodEnd && (
                <button
                  className="btn"
                  style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                  disabled={actionLoading}
                  onClick={handleCancel}
                >
                  {actionLoading ? 'Procesando...' : 'Cancelar Suscripcion'}
                </button>
              )}

              {billing?.subscription?.cancelAtPeriodEnd && (
                <button
                  className="btn btn-primary"
                  disabled={actionLoading}
                  onClick={handleReactivate}
                >
                  {actionLoading ? 'Procesando...' : 'Reactivar Suscripcion'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Usage */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h3 className="card-title">Uso del Plan</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Messages usage */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Mensajes este mes</span>
                <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                  {usage?.messages_used?.toLocaleString() || 0}
                  {' / '}
                  {usage?.messages_limit === -1 ? 'Ilimitado' : (usage?.messages_limit?.toLocaleString() || 0)}
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                background: 'var(--color-border)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: usage?.messages_limit === -1 ? '5%' : `${Math.min(usage?.usage_percentage || 0, 100)}%`,
                  height: '100%',
                  background: usage?.messages_limit === -1 ? 'var(--color-success)' : getUsageColor(usage?.usage_percentage || 0),
                  borderRadius: '4px',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>

            {/* Products usage */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Productos sincronizados</span>
                <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                  {usage?.products_synced?.toLocaleString() || 0}
                  {' / '}
                  {usage?.products_limit === -1 ? 'Ilimitado' : (usage?.products_limit?.toLocaleString() || 0)}
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                background: 'var(--color-border)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}>
                {(() => {
                  const prodPercentage = usage?.products_limit === -1
                    ? 5
                    : usage?.products_limit
                      ? Math.min(Math.round(((usage?.products_synced || 0) / usage.products_limit) * 100), 100)
                      : 0;
                  return (
                    <div style={{
                      width: `${prodPercentage}%`,
                      height: '100%',
                      background: usage?.products_limit === -1 ? 'var(--color-success)' : getUsageColor(prodPercentage),
                      borderRadius: '4px',
                      transition: 'width 0.3s ease',
                    }} />
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Change Plan */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Cambiar Plan</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${plans.length || 4}, 1fr)`, gap: '1.5rem' }}>
            {plans.map((plan) => {
              const isCurrentPlan = billing?.plan === plan.slug;
              const isPopular = plan.slug === 'professional';
              const features = formatFeatures(plan);
              const priceDisplay = plan.price === 0 ? 'Gratis' : plan.slug === 'enterprise' ? 'Personalizado' : `$${plan.price}`;
              const periodDisplay = plan.price > 0 && plan.slug !== 'enterprise' ? '/mes' : '';
              return (
                <div
                  key={plan.slug}
                  className="card"
                  style={{
                    position: 'relative',
                    border: isPopular ? '2px solid var(--color-primary)' : undefined,
                  }}
                >
                  {isPopular && (
                    <div style={{
                      position: 'absolute',
                      top: '-12px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'var(--color-primary)',
                      color: 'white',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                    }}>
                      Popular
                    </div>
                  )}
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <span className={`badge badge-${plan.badge_color}`} style={{ marginBottom: '1rem' }}>
                      {plan.name}
                    </span>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-text)' }}>
                      {priceDisplay}
                      <span style={{ fontSize: '1rem', fontWeight: '400', color: 'var(--color-text-secondary)' }}>
                        {periodDisplay}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                      {plan.description}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    {features.map((feature, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{feature}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    className={`btn ${isCurrentPlan ? 'btn-secondary' : 'btn-primary'}`}
                    style={{ width: '100%' }}
                    disabled={isCurrentPlan || actionLoading}
                    onClick={() => !isCurrentPlan && handleCheckout(plan.slug)}
                  >
                    {isCurrentPlan ? 'Plan Actual' : actionLoading ? 'Procesando...' : plan.price === 0 ? 'Cambiar a Gratis' : 'Seleccionar'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

export default Subscription;
