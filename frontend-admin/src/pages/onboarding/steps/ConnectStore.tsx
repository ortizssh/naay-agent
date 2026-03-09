import { useState } from 'react';

interface ConnectStoreProps {
  onBack: () => void;
  onConnect: (shopDomain: string) => Promise<void>;
  isConnecting: boolean;
}

function ConnectStore({ onBack, onConnect, isConnecting }: ConnectStoreProps) {
  const [shopDomain, setShopDomain] = useState('');
  const [error, setError] = useState('');

  const handleConnect = async () => {
    if (!shopDomain.trim()) {
      setError('Ingresa el nombre de tu tienda');
      return;
    }

    setError('');
    try {
      await onConnect(shopDomain);
    } catch (err: any) {
      setError(err.message || 'Error al conectar');
    }
  };

  return (
    <>
      <h2 className="onboarding-title">Conecta tu tienda Shopify</h2>
      <p className="onboarding-subtitle">
        Ingresa el nombre de tu tienda para iniciar la conexión
      </p>

      <div style={{ marginBottom: '1.5rem' }}>
        <label className="form-label">Nombre de tu tienda</label>
        <div className="connect-store-input">
          <input
            type="text"
            className="form-input"
            placeholder="mi-tienda"
            value={shopDomain}
            onChange={(e) => setShopDomain(e.target.value)}
            disabled={isConnecting}
          />
          <div className="connect-store-suffix">.myshopify.com</div>
        </div>
        {error && (
          <div className="form-hint" style={{ color: 'var(--color-error)' }}>
            {error}
          </div>
        )}
        <div className="form-hint">
          Puedes encontrar el nombre de tu tienda en la URL de tu panel de Shopify
        </div>
      </div>

      <div className="card" style={{ background: 'var(--color-bg)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'var(--color-primary-soft)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Conexión segura</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
              Utilizamos OAuth de Shopify para conectar de forma segura.
              Solo solicitamos permisos de lectura de productos y órdenes.
            </div>
          </div>
        </div>
      </div>

      <div className="onboarding-nav">
        <button className="btn btn-secondary" onClick={onBack} disabled={isConnecting}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Atrás
        </button>
        <button
          className="btn btn-primary"
          onClick={handleConnect}
          disabled={isConnecting || !shopDomain.trim()}
        >
          {isConnecting ? (
            <>
              <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></div>
              Conectando...
            </>
          ) : (
            <>
              Conectar con Shopify
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

export default ConnectStore;
