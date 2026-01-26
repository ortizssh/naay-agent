import CodeSnippet from '../../../components/common/CodeSnippet';

interface ActivateProps {
  widgetCode: string;
  shopDomain: string;
  onBack: () => void;
  onComplete: () => void;
  isActivating: boolean;
}

function Activate({ widgetCode, shopDomain, onBack, onComplete, isActivating }: ActivateProps) {
  return (
    <>
      <div className="success-checkmark">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h2 className="onboarding-title">Tu tienda esta lista!</h2>
      <p className="onboarding-subtitle">
        Instala el widget en tu tienda y comienza a vender mas con AI
      </p>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h3 className="card-title">Opcion 1: Extension de Shopify (Recomendado)</h3>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
          La forma mas facil. Ve a tu panel de Shopify {'>'} Tema {'>'} Personalizar {'>'}
          App embeds y activa "Naay Chat Widget".
        </p>
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
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h3 className="card-title">Opcion 2: Codigo Manual</h3>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
          Copia y pega este codigo en tu tema de Shopify, antes del cierre del tag {'</body>'}.
        </p>
        <CodeSnippet code={widgetCode} />
      </div>

      <div className="card" style={{ background: 'var(--color-success-soft)', border: 'none' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'var(--color-success)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: '600', marginBottom: '0.25rem', color: 'var(--color-success)' }}>
              Trial de 14 dias gratis
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
              Tu periodo de prueba comienza ahora. Tendras acceso completo a todas las funciones.
              No se requiere tarjeta de credito.
            </div>
          </div>
        </div>
      </div>

      <div className="onboarding-nav" style={{ marginTop: '2rem' }}>
        <button className="btn btn-secondary" onClick={onBack} disabled={isActivating}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Atras
        </button>
        <button
          className="btn btn-primary"
          onClick={onComplete}
          disabled={isActivating}
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

export default Activate;
