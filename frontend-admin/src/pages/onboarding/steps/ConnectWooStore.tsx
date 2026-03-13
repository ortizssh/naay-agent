import { useState, useEffect, useRef } from 'react';

interface ConnectWooStoreProps {
  onBack: () => void;
  onConnected: () => void;
}

type Phase = 'url' | 'instructions';

function ConnectWooStore({ onBack, onConnected }: ConnectWooStoreProps) {
  const [phase, setPhase] = useState<Phase>('url');
  const [siteUrl, setSiteUrl] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [isPolling, setIsPolling] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const apiUrl = localStorage.getItem('api_url')
    || import.meta.env.VITE_API_URL
    || (window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin);

  const token = localStorage.getItem('auth_token');

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const handleSubmitUrl = async () => {
    if (!siteUrl.trim()) {
      setError('Ingresa la URL de tu tienda');
      return;
    }

    setError('');
    setIsConnecting(true);

    try {
      const response = await fetch(`${apiUrl}/api/client/store/connect-woo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ siteUrl: siteUrl.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Error al registrar la tienda');
      }

      // Move to instructions phase and start polling
      setPhase('instructions');
      startPolling();
    } catch (err: any) {
      setError(err.message || 'Error al registrar la tienda');
    } finally {
      setIsConnecting(false);
    }
  };

  const startPolling = () => {
    setIsPolling(true);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${apiUrl}/api/client/store`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const data = await response.json();

        if (data.success && data.data && data.data.status === 'active') {
          // Plugin connected — stop polling and advance
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          setIsPolling(false);
          onConnected();
        }
      } catch {
        // Ignore polling errors, will retry
      }
    }, 5000);
  };

  const handleManualAdvance = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    setIsPolling(false);
    onConnected();
  };

  // Phase 1: URL input
  if (phase === 'url') {
    return (
      <>
        <h2 className="onboarding-title">Conecta tu tienda WooCommerce</h2>
        <p className="onboarding-subtitle">
          Ingresa la URL de tu tienda WordPress con WooCommerce
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
              onKeyDown={(e) => e.key === 'Enter' && handleSubmitUrl()}
            />
            <div className="form-hint">
              La URL principal de tu tienda WordPress con WooCommerce
            </div>
          </div>

          {error && (
            <div className="form-hint" style={{ color: 'var(--color-error)' }}>
              {error}
            </div>
          )}
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
            onClick={handleSubmitUrl}
            disabled={isConnecting || !siteUrl.trim()}
          >
            {isConnecting ? (
              <>
                <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></div>
                Registrando...
              </>
            ) : (
              <>
                Continuar
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

  // Phase 2: Plugin installation instructions + polling
  return (
    <>
      <h2 className="onboarding-title">Instala el plugin de Kova</h2>
      <p className="onboarding-subtitle">
        Descarga e instala el plugin en tu sitio WordPress para completar la conexión
      </p>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div style={{
            width: '32px',
            height: '32px',
            background: 'var(--color-primary)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'white',
            fontWeight: '700',
            fontSize: '0.85rem',
          }}>1</div>
          <div>
            <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Descarga el plugin</div>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', margin: '0 0 0.75rem 0' }}>
              Descarga el archivo .zip del plugin de Kova Agent para WordPress.
            </p>
            <a
              href={`${apiUrl}/api/woo/plugin/download`}
              download
              className="btn btn-primary"
              style={{ display: 'inline-flex' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Descargar Plugin
            </a>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div style={{
            width: '32px',
            height: '32px',
            background: 'var(--color-primary)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'white',
            fontWeight: '700',
            fontSize: '0.85rem',
          }}>2</div>
          <div>
            <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Sube el plugin a WordPress</div>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', margin: 0 }}>
              Ve a tu panel de WordPress {'>'} Plugins {'>'} Añadir nuevo {'>'} Subir plugin.
              Selecciona el archivo .zip descargado e instala.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{
            width: '32px',
            height: '32px',
            background: 'var(--color-primary)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'white',
            fontWeight: '700',
            fontSize: '0.85rem',
          }}>3</div>
          <div>
            <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Activa el plugin</div>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', margin: 0 }}>
              Activa el plugin en WordPress. Las claves de API se generarán automáticamente
              y tu tienda se conectará con Kova.
            </p>
          </div>
        </div>
      </div>

      {isPolling && (
        <div className="card" style={{ background: 'var(--color-bg)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div className="loading-spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></div>
            <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
              Esperando conexión del plugin...
            </span>
          </div>
        </div>
      )}

      <div className="onboarding-nav">
        <button className="btn btn-secondary" onClick={() => setPhase('url')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Atrás
        </button>
        <button
          className="btn btn-primary"
          onClick={handleManualAdvance}
        >
          Ya instalé el plugin
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </>
  );
}

export default ConnectWooStore;
