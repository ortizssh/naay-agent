import { useState } from 'react';

interface ConnectWooStoreProps {
  onBack: () => void;
  onConnected: () => void;
}

function ConnectWooStore({ onBack, onConnected }: ConnectWooStoreProps) {
  const [siteUrl, setSiteUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  const handleConnect = async () => {
    if (!siteUrl.trim()) {
      setError('Ingresa la URL de tu tienda');
      return;
    }
    if (!consumerKey.trim() || !consumerSecret.trim()) {
      setError('Ingresa las claves de API de WooCommerce');
      return;
    }

    // Normalize URL
    let normalizedUrl = siteUrl.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    // Remove trailing slash
    normalizedUrl = normalizedUrl.replace(/\/+$/, '');

    setError('');
    setIsConnecting(true);

    try {
      const apiUrl = localStorage.getItem('api_url')
        || import.meta.env.VITE_API_URL
        || (window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin);

      const token = localStorage.getItem('auth_token');

      const response = await fetch(`${apiUrl}/api/client/store/connect-woo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          siteUrl: normalizedUrl,
          consumerKey: consumerKey.trim(),
          consumerSecret: consumerSecret.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Error al conectar la tienda');
      }

      onConnected();
    } catch (err: any) {
      setError(err.message || 'Error al conectar la tienda');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <>
      <h2 className="onboarding-title">Conecta tu tienda WooCommerce</h2>
      <p className="onboarding-subtitle">
        Ingresa la URL de tu tienda y las claves de API de WooCommerce
      </p>

      <div style={{ marginBottom: '1.5rem' }}>
        <div className="form-group">
          <label className="form-label">URL de tu tienda</label>
          <input
            type="text"
            className="form-input"
            placeholder="https://mitienda.com"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            disabled={isConnecting}
          />
          <div className="form-hint">
            La URL principal de tu tienda WordPress con WooCommerce
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Consumer Key</label>
          <input
            type="text"
            className="form-input"
            placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={consumerKey}
            onChange={(e) => setConsumerKey(e.target.value)}
            disabled={isConnecting}
            style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Consumer Secret</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showSecret ? 'text' : 'password'}
              className="form-input"
              placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={consumerSecret}
              onChange={(e) => setConsumerSecret(e.target.value)}
              disabled={isConnecting}
              style={{ fontFamily: 'monospace', fontSize: '0.85rem', paddingRight: '3rem' }}
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                padding: '0.25rem',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {showSecret ? (
                  <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                ) : (
                  <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {error && (
          <div className="form-hint" style={{ color: 'var(--color-error)' }}>
            {error}
          </div>
        )}
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
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Obtener claves de API</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
              En tu panel de WordPress ve a <strong>WooCommerce &gt; Ajustes &gt; Avanzado &gt; REST API</strong> y
              crea una nueva clave con permisos de <strong>Lectura/Escritura</strong>.
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
          disabled={isConnecting || !siteUrl.trim() || !consumerKey.trim() || !consumerSecret.trim()}
        >
          {isConnecting ? (
            <>
              <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></div>
              Conectando...
            </>
          ) : (
            <>
              Conectar tienda
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

export default ConnectWooStore;
