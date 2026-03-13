import { useState } from 'react';

interface WooInstructionsProps {
  onBack: () => void;
  onComplete: () => void;
}

function WooInstructions({ onBack, onComplete }: WooInstructionsProps) {
  const [isCompleting, setIsCompleting] = useState(false);

  const apiUrl = localStorage.getItem('api_url')
    || import.meta.env.VITE_API_URL
    || (window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin);

  const handleComplete = () => {
    setIsCompleting(true);
    onComplete();
  };

  return (
    <>
      <h2 className="onboarding-title">Configura WooCommerce</h2>
      <p className="onboarding-subtitle">
        Instala el plugin de Kova Agent en tu sitio WordPress para conectar tu tienda
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
            <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Activa y configura</div>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', margin: 0 }}>
              Activa el plugin. Se abrirá un asistente de configuración que te guiará
              para conectar tu tienda, personalizar el widget y sincronizar tus productos.
            </p>
          </div>
        </div>
      </div>

      <div className="onboarding-nav">
        <button className="btn btn-secondary" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Atrás
        </button>
        <button
          className="btn btn-primary"
          onClick={handleComplete}
          disabled={isCompleting}
        >
          {isCompleting ? (
            <>
              <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></div>
              Completando...
            </>
          ) : (
            <>
              Ya instalé el plugin
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

export default WooInstructions;
