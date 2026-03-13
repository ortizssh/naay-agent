import { useState, useEffect } from 'react';
import { clientApi } from '../../services/api';

interface DashboardData {
  totalStores: number;
  activeStores: number;
  totalProducts: number;
  onboardingCompleted: boolean;
  onboardingStep: number;
  plan: string;
}

interface UsageData {
  messages_used: number;
  messages_limit: number;
  usage_percentage: number;
  voice_calls_used?: number;
  voice_calls_limit?: number;
}

interface ClientDashboardProps {
  onStartOnboarding: () => void;
  onPageChange?: (page: string) => void;
}

function ClientDashboard({ onStartOnboarding, onPageChange }: ClientDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [dashRes, usageRes] = await Promise.all([
        clientApi.getDashboard(),
        clientApi.getUsage().catch(() => null),
      ]);
      setData(dashRes.data);
      if (usageRes) setUsage(usageRes.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'var(--color-error)';
    if (percentage >= 70) return 'var(--color-warning)';
    return 'var(--color-success)';
  };

  if (loading) {
    return (
      <>
        <header className="page-header">
          <div className="page-header-content">
            <div>
              <h1 className="page-title">Mi Dashboard</h1>
              <p className="page-subtitle">Resumen de tu tienda</p>
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

  return (
    <>
      <header className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">Mi Dashboard</h1>
            <p className="page-subtitle">Resumen de tu tienda</p>
          </div>
          <button className="btn btn-primary" onClick={loadDashboard}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Actualizar
          </button>
        </div>
      </header>

      <div className="page-content">
        {error && (
          <div className="alert alert-error">
            <svg className="alert-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="alert-content">
              <div className="alert-title">Error</div>
              <div className="alert-message">{error}</div>
            </div>
          </div>
        )}

        {/* Setup checklist */}
        {data && (() => {
          const storeConnected = data.activeStores > 0;
          const widgetCustomized = data.onboardingStep >= 5;
          const firstConversation = !!(usage && usage.messages_used > 0);
          const allDone = storeConnected && widgetCustomized && firstConversation;
          if (allDone) return null;

          const steps = [
            { label: 'Crear cuenta', done: true, onClick: undefined },
            { label: 'Conectar tienda', done: storeConnected, onClick: !storeConnected ? onStartOnboarding : undefined },
            { label: 'Personalizar widget', done: widgetCustomized, onClick: !widgetCustomized ? () => onPageChange?.('widget') : undefined },
            { label: 'Primera conversación', done: firstConversation, onClick: undefined },
          ];
          const completed = steps.filter(s => s.done).length;
          const progress = Math.round((completed / steps.length) * 100);

          return (
            <div className="quick-setup-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Completa tu setup</h3>
                <span style={{ fontSize: '0.85rem', opacity: 0.85, fontWeight: 500 }}>{completed}/{steps.length}</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3, marginBottom: '1.25rem', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: '#4ade80', borderRadius: 3, transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {steps.map((step, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      cursor: step.onClick ? 'pointer' : 'default',
                      opacity: step.done ? 1 : 0.75,
                    }}
                    onClick={() => step.onClick?.()}
                  >
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: step.done ? '#4ade80' : 'rgba(255,255,255,0.15)',
                      border: step.done ? 'none' : '2px solid rgba(255,255,255,0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.2s ease',
                    }}>
                      {step.done && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span style={{
                      fontSize: '0.95rem',
                      fontWeight: step.done ? 500 : 400,
                      textDecoration: step.done ? 'line-through' : 'none',
                      textDecorationColor: 'rgba(255,255,255,0.5)',
                    }}>
                      {step.label}
                    </span>
                    {step.onClick && !step.done && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto', opacity: 0.6 }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
              {!storeConnected && (
                <button className="btn" onClick={onStartOnboarding} style={{ marginTop: '1.25rem' }}>
                  Continuar configuración
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              )}
            </div>
          );
        })()}

        {/* Stats */}
        <div className="client-stats-grid">
          <div className="stat-card">
            <div className="stat-icon primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div className="stat-value">{data?.activeStores || 0}</div>
            <div className="stat-label">Tiendas Activas</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon success">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div className="stat-value">{data?.totalProducts || 0}</div>
            <div className="stat-label">Productos Sincronizados</div>
          </div>

          <div className="stat-card" style={{ cursor: onPageChange ? 'pointer' : undefined }} onClick={() => onPageChange?.('subscription')}>
            <div className="stat-icon warning">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="stat-value" style={{ textTransform: 'capitalize' }}>{data?.plan || 'free'}</div>
            <div className="stat-label">Plan Actual</div>
          </div>

        </div>

        {/* Usage row */}
        {usage && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: `${getUsageColor(usage.usage_percentage)}20`, color: getUsageColor(usage.usage_percentage) }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="stat-value">
                {usage.messages_used?.toLocaleString() || 0}{' / '}{usage.messages_limit === -1 ? 'Ilim.' : (usage.messages_limit || 100).toLocaleString()}
              </div>
              <div className="stat-label">Mensajes este mes</div>
              <div style={{
                width: '100%',
                height: '4px',
                background: 'var(--color-border)',
                borderRadius: '2px',
                overflow: 'hidden',
                marginTop: '0.5rem',
              }}>
                <div style={{
                  width: usage.messages_limit === -1 ? '5%' : `${Math.min(usage.usage_percentage, 100)}%`,
                  height: '100%',
                  background: usage.messages_limit === -1 ? 'var(--color-success)' : getUsageColor(usage.usage_percentage),
                  borderRadius: '2px',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>

            {(() => {
              const vcUsed = usage.voice_calls_used ?? 0;
              const vcLimit = usage.voice_calls_limit ?? 0;
              const vcIsUnlimited = vcLimit === -1;
              const vcPct = vcIsUnlimited ? 0 : vcLimit > 0 ? Math.min(100, Math.round((vcUsed / vcLimit) * 100)) : 0;
              const vcColor = vcLimit === 0 ? '#94a3b8' : vcIsUnlimited ? 'var(--color-success)' : getUsageColor(vcPct);

              return (
                <div className="stat-card" style={{ cursor: onPageChange ? 'pointer' : undefined }} onClick={() => onPageChange?.('voice-agent')}>
                  <div className="stat-icon" style={{ background: `${vcColor}20`, color: vcColor }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </div>
                  <div className="stat-value">
                    {vcLimit === 0
                      ? vcUsed.toLocaleString()
                      : <>{vcUsed.toLocaleString()}{' / '}{vcIsUnlimited ? 'Ilim.' : vcLimit.toLocaleString()}</>
                    }
                  </div>
                  <div className="stat-label">Llamadas este mes</div>
                  <div style={{
                    width: '100%',
                    height: '4px',
                    background: 'var(--color-border)',
                    borderRadius: '2px',
                    overflow: 'hidden',
                    marginTop: '0.5rem',
                  }}>
                    <div style={{
                      width: vcIsUnlimited ? '5%' : vcLimit > 0 ? `${vcPct}%` : '0%',
                      height: '100%',
                      background: vcColor,
                      borderRadius: '2px',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Quick actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Acciones Rápidas</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => onPageChange?.('widget')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Configurar Widget
              </button>
              <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => onPageChange?.('analytics')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                Ver Estadísticas
              </button>
              <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => onPageChange?.('store')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Sincronizar Productos
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Estado del Servicio</h3>
              <span className="badge badge-success">Operativo</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Widget Chat</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)' }}></div>
                  <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Activo</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>AI Service</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)' }}></div>
                  <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Online</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Sincronización</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)' }}></div>
                  <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Actualizado</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ClientDashboard;
