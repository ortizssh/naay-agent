import { useState, useEffect, useRef } from 'react';
import { clientApi } from '../../../services/api';
import CodeSnippet from '../../../components/common/CodeSnippet';

interface SyncAndActivateProps {
  onBack: () => void;
  onComplete: () => void;
}

function SyncAndActivate({ onBack, onComplete }: SyncAndActivateProps) {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'completed' | 'failed'>('idle');
  const [synced, setSynced] = useState(0);
  const [total, setTotal] = useState(0);
  const [isActivating, setIsActivating] = useState(false);
  const [widgetCode, setWidgetCode] = useState('');
  const [shopDomain, setShopDomain] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    startSync();
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const startSync = async () => {
    try {
      setSyncStatus('syncing');
      await clientApi.triggerSync();
      startPolling();
    } catch (error) {
      console.error('Error starting sync:', error);
      setSyncStatus('failed');
    }
  };

  const startPolling = () => {
    pollingRef.current = setInterval(async () => {
      try {
        const response = await clientApi.getSyncStatus();
        const data = response.data;

        setSynced(data.synced);
        setTotal(data.total);

        if (data.status === 'completed') {
          setSyncStatus('completed');
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          // Load widget code
          loadWidgetCode();
        } else if (data.status === 'failed') {
          setSyncStatus('failed');
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (error) {
        console.error('Error polling sync status:', error);
      }
    }, 3000);
  };

  const loadWidgetCode = async () => {
    try {
      const codeResponse = await clientApi.getWidgetCode();
      setWidgetCode(codeResponse.data?.code || '');
      setShopDomain(codeResponse.data?.shopDomain || '');
    } catch (error) {
      console.error('Error loading widget code:', error);
    }
  };

  const handleComplete = async () => {
    setIsActivating(true);
    try {
      await clientApi.updateOnboardingStep(5);
      onComplete();
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsActivating(false);
    }
  };

  const progressPercent = total > 0 ? Math.round((synced / total) * 100) : 0;

  return (
    <>
      <h2 className="onboarding-title">Sincronizar y activar</h2>
      <p className="onboarding-subtitle">
        Sincronizamos tus productos y preparamos el widget para tu tienda
      </p>

      {/* Sync Progress */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h3 className="card-title">Sincronización de productos</h3>
        </div>

        {syncStatus === 'syncing' && (
          <>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{
                height: '8px',
                background: 'var(--color-bg)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${total > 0 ? progressPercent : 30}%`,
                  background: 'var(--color-primary)',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease',
                  animation: total === 0 ? 'pulse 1.5s ease-in-out infinite' : 'none',
                }}></div>
              </div>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', margin: 0 }}>
              {total > 0
                ? `Sincronizando productos... (${synced} de ${total})`
                : 'Obteniendo productos de tu tienda...'}
            </p>
          </>
        )}

        {syncStatus === 'completed' && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{
              width: '32px',
              height: '32px',
              background: 'var(--color-success)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: '600', color: 'var(--color-success)' }}>
                Sincronización completada
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                {synced} productos sincronizados exitosamente
              </div>
            </div>
          </div>
        )}

        {syncStatus === 'failed' && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{
              width: '32px',
              height: '32px',
              background: 'var(--color-error)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: '600', color: 'var(--color-error)' }}>
                Error en la sincronización
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                Puedes continuar y sincronizar después desde el dashboard
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Installation instructions - show after sync */}
      {(syncStatus === 'completed' || syncStatus === 'failed') && (
        <>
          {shopDomain && !shopDomain.includes('.myshopify.com') ? (
            /* WooCommerce: show widget code snippet */
            widgetCode && (
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                  <h3 className="card-title">Instala el widget en tu tienda</h3>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                  Copia y pega este código en tu tema de WordPress, antes del cierre del tag {'</body>'},
                  o usa el plugin de Kova para instalarlo automáticamente.
                </p>
                <CodeSnippet code={widgetCode} />
              </div>
            )
          ) : (
            /* Shopify: show theme editor + manual code */
            <>
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header">
                  <h3 className="card-title">Opción 1: Extension de Shopify (Recomendado)</h3>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                  La forma más fácil. Ve a tu panel de Shopify {'>'} Tema {'>'} Personalizar {'>'}
                  App embeds y activa "Kova AI Chat Widget".
                </p>
                {shopDomain && (
                  <a
                    href={`https://${shopDomain}/admin/themes/current/editor`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ display: 'inline-flex' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    Ir al Editor de Tema
                  </a>
                )}
              </div>

              {widgetCode && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <div className="card-header">
                    <h3 className="card-title">Opción 2: Código Manual</h3>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                    Copia y pega este código en tu tema, antes del cierre del tag {'</body>'}.
                  </p>
                  <CodeSnippet code={widgetCode} />
                </div>
              )}
            </>
          )}
        </>
      )}

      <div className="onboarding-nav" style={{ marginTop: '2rem' }}>
        <button className="btn btn-secondary" onClick={onBack} disabled={isActivating || syncStatus === 'syncing'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Atrás
        </button>
        <button
          className="btn btn-primary"
          onClick={handleComplete}
          disabled={isActivating || syncStatus === 'syncing'}
        >
          {isActivating ? (
            <>
              <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></div>
              Activando...
            </>
          ) : (
            <>
              Ir al Dashboard
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </>
          )}
        </button>
      </div>
    </>
  );
}

export default SyncAndActivate;
