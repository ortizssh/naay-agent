interface PlatformSelectProps {
  selectedPlatform: string;
  onSelect: (platform: string) => void;
  onNext: () => void;
}

function PlatformSelect({ selectedPlatform, onSelect, onNext }: PlatformSelectProps) {
  return (
    <>
      <h2 className="onboarding-title">Selecciona tu plataforma</h2>
      <p className="onboarding-subtitle">
        Conecta tu tienda para comenzar a usar el asistente AI
      </p>

      <div className="platform-options">
        <div
          className={`platform-card ${selectedPlatform === 'shopify' ? 'selected' : ''}`}
          onClick={() => onSelect('shopify')}
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
          onClick={() => onSelect('woocommerce')}
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
          disabled={!selectedPlatform}
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
