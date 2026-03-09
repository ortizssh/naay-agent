import { useState, useEffect } from 'react';
import { clientApi, Plan } from '../../../services/api';

interface SelectPlanProps {
  onBack: () => void;
  onNext: () => void;
}

function SelectPlan({ onBack, onNext }: SelectPlanProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clientApi
      .getAvailablePlans()
      .then(res => {
        if (res.data) {
          setPlans(res.data);
        }
      })
      .catch(() => setError('Error al cargar planes'))
      .finally(() => setLoading(false));
  }, []);

  const formatFeatures = (plan: Plan): string[] => {
    const features: string[] = [];
    const msgs =
      plan.monthly_messages === -1
        ? 'Mensajes ilimitados'
        : `${plan.monthly_messages.toLocaleString()} mensajes/mes`;
    const prods =
      plan.products_limit === -1
        ? 'Productos ilimitados'
        : `${plan.products_limit.toLocaleString()} productos`;
    features.push(msgs, prods);
    if (plan.features.analytics) features.push('Analytics');
    if (plan.features.custom_branding) features.push('Branding personalizado');
    if (plan.features.priority_support) features.push('Soporte prioritario');
    if (plan.features.api_access) features.push('Acceso API');
    return features;
  };

  const handleSelectPlan = async (planSlug: string) => {
    setSelectedPlan(planSlug);
    setProcessing(true);
    setError(null);

    try {
      // Save plan selection step
      await clientApi.updateOnboardingStep(3, { planSlug });

      // Redirect to Stripe Checkout
      const res = await clientApi.createCheckout(planSlug);
      if (res.data?.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
      } else if (res.data?.free) {
        onNext();
      } else {
        setError('Error al crear sesión de pago');
        setProcessing(false);
      }
    } catch (err: any) {
      setError(err.message || 'Error al seleccionar plan');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <>
        <h2 className="onboarding-title">Selecciona tu plan</h2>
        <p className="onboarding-subtitle">Cargando planes disponibles...</p>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" />
        </div>
      </>
    );
  }

  return (
    <>
      <h2 className="onboarding-title">Selecciona tu plan</h2>
      <p className="onboarding-subtitle">
        Elige el plan que mejor se adapte a tu negocio.
      </p>

      {error && (
        <div
          className="alert alert-error"
          style={{ marginBottom: '1.5rem' }}
        >
          <svg
            className="alert-icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="alert-content">
            <div className="alert-message">{error}</div>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(plans.filter(p => p.price > 0).length, 3)}, 1fr)`,
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        {plans.filter(plan => plan.price > 0).map(plan => {
          const isPopular = plan.slug === 'professional';
          const features = formatFeatures(plan);
          const priceDisplay = `$${plan.price}`;
          const periodDisplay = '/mes';
          const isSelected = selectedPlan === plan.slug;

          return (
            <div
              key={plan.slug}
              className="card"
              style={{
                position: 'relative',
                border: isPopular
                  ? '2px solid var(--color-primary)'
                  : isSelected
                    ? '2px solid var(--color-primary)'
                    : undefined,
                cursor: processing ? 'not-allowed' : 'pointer',
                opacity: processing && !isSelected ? 0.6 : 1,
                transition: 'all 0.2s ease',
              }}
              onClick={() => !processing && handleSelectPlan(plan.slug)}
            >
              {isPopular && (
                <div
                  style={{
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
                  }}
                >
                  Popular
                </div>
              )}

              <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <span
                  className={`badge badge-${plan.badge_color}`}
                  style={{ marginBottom: '0.75rem', display: 'inline-block' }}
                >
                  {plan.name}
                </span>
                <div
                  style={{
                    fontSize: '1.75rem',
                    fontWeight: '700',
                    color: 'var(--color-text)',
                  }}
                >
                  {priceDisplay}
                  <span
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: '400',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {periodDisplay}
                  </span>
                </div>
                {plan.description && (
                  <div
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--color-text-muted)',
                      marginTop: '0.4rem',
                    }}
                  >
                    {plan.description}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  marginBottom: '1.25rem',
                }}
              >
                {features.map((feature, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--color-success)"
                      strokeWidth="2"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              <button
                className={`btn ${isSelected && processing ? 'btn-secondary' : 'btn-primary'}`}
                style={{ width: '100%' }}
                disabled={processing}
              >
                {isSelected && processing
                  ? 'Procesando...'
                  : 'Seleccionar plan'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="onboarding-nav">
        <button
          className="btn btn-secondary"
          onClick={onBack}
          disabled={processing}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Atrás
        </button>
      </div>
    </>
  );
}

export default SelectPlan;
