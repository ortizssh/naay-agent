import { useState } from 'react';
import { clientApi } from '../../../services/api';

interface PlatformSelectProps {
  selectedPlatform: string;
  onSelect: (platform: string) => void;
  onNext: () => void;
  onComplete: () => void;
}

function PlatformSelect({ selectedPlatform, onSelect, onNext, onComplete }: PlatformSelectProps) {
  const [showWooInstructions, setShowWooInstructions] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const handlePlatformClick = (platform: string) => {
    onSelect(platform);
    if (platform === 'woocommerce') {
      setShowWooInstructions(true);
    } else {
      setShowWooInstructions(false);
    }
  };

  const handleWooComplete = async () => {
    setIsCompleting(true);
    try {
      await clientApi.updateOnboardingStep(5);
      onComplete();
    } catch (error) {
      console.error('Error completing onboarding:', error);
      onComplete();
    }
  };

  const apiUrl = localStorage.getItem('api_url')
    || import.meta.env.VITE_API_URL
    || (window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin);

  if (showWooInstructions) {
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
                href={`${apiUrl}/static/downloads/kova-agent.zip`}
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
                Ve a tu panel de WordPress {'>'} Plugins {'>'} Anadir nuevo {'>'} Subir plugin.
                Selecciona el archivo .zip descargado e instala.
              </p>
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
            }}>3</div>
            <div>
              <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Activa y configura</div>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                Activa el plugin. Se abrira un asistente de configuracion que te guiara
                para conectar tu tienda, personalizar el widget y sincronizar tus productos.
              </p>
            </div>
          </div>
        </div>

        <div className="onboarding-nav">
          <button className="btn btn-secondary" onClick={() => setShowWooInstructions(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Atras
          </button>
          <button
            className="btn btn-primary"
            onClick={handleWooComplete}
            disabled={isCompleting}
          >
            {isCompleting ? (
              <>
                <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></div>
                Completando...
              </>
            ) : (
              <>
                Ya instale el plugin
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

  return (
    <>
      <h2 className="onboarding-title">Selecciona tu plataforma</h2>
      <p className="onboarding-subtitle">
        Conecta tu tienda para comenzar a usar el asistente AI
      </p>

      <div className="platform-options">
        <div
          className={`platform-card ${selectedPlatform === 'shopify' ? 'selected' : ''}`}
          onClick={() => handlePlatformClick('shopify')}
        >
          <div className="platform-icon" style={{ background: '#95bf47' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <path d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.021-.116-.124-.2-.251-.208-.127-.007-2.832-.205-2.832-.205s-1.872-1.854-2.085-2.06c-.213-.206-.63-.146-.794-.1-.003 0-.152.047-.398.123-.236-.692-.655-1.498-1.383-2.241-.962-.975-2.302-1.461-3.889-1.461-.117 0-.235.003-.354.012-.174-.225-.383-.405-.611-.539-.802-.471-1.804-.534-2.736-.179-2.436.928-4.066 3.506-4.503 6.269-.693.215-1.186.367-1.254.388-.785.246-.81.27-.914.978-.078.534-2.124 16.358-2.124 16.358l15.866 2.974zm-5.139-17.097c0 .098-.002.193-.006.287l-1.729.536c.329-1.266.958-1.878 1.735-2.076v1.253z" />
            </svg>
          </div>
          <div className="platform-name">Shopify</div>
          <div className="platform-status">Disponible</div>
        </div>

        <div
          className={`platform-card ${selectedPlatform === 'woocommerce' ? 'selected' : ''}`}
          onClick={() => handlePlatformClick('woocommerce')}
        >
          <div className="platform-icon" style={{ background: '#7f54b3' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <path d="M21.993 7.471c.019-.159.019-.319 0-.478-.04-.32-.128-.633-.26-.926a3.48 3.48 0 0 0-1.09-1.386 3.48 3.48 0 0 0-1.614-.695 3.48 3.48 0 0 0-1.709.12 3.48 3.48 0 0 0-1.424.872L12 9.074 8.104 4.978a3.48 3.48 0 0 0-1.424-.872 3.48 3.48 0 0 0-1.709-.12 3.48 3.48 0 0 0-1.614.695 3.48 3.48 0 0 0-1.09 1.386 3.48 3.48 0 0 0-.26.926c-.019.159-.019.319 0 .478.04.32.128.633.26.926.133.294.31.565.526.804L7.2 13.95v5.55a1.5 1.5 0 0 0 1.5 1.5h6.6a1.5 1.5 0 0 0 1.5-1.5v-5.55l4.407-4.749c.216-.239.393-.51.526-.804.132-.293.22-.606.26-.926z" />
            </svg>
          </div>
          <div className="platform-name">WooCommerce</div>
          <div className="platform-status">Disponible</div>
        </div>
      </div>

      <div className="onboarding-nav">
        <div></div>
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={!selectedPlatform || selectedPlatform === 'woocommerce'}
        >
          Continuar
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </>
  );
}

export default PlatformSelect;
