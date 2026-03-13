interface PlatformSelectProps {
  selectedPlatform: string;
  onSelect: (platform: string) => void;
  onNext: () => void;
}

const ShopifyIcon = () => (
  <img
    src="https://cdn.iconscout.com/icon/free/png-256/free-shopify-logo-icon-svg-download-png-2945149.png?f=webp"
    alt="Shopify"
    width="60"
    height="60"
    style={{ borderRadius: '12px', objectFit: 'contain' }}
  />
);

const WooCommerceIcon = () => (
  <img
    src="https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/woocommerce-icon.png"
    alt="WooCommerce"
    width="60"
    height="60"
    style={{ borderRadius: '12px', objectFit: 'contain' }}
  />
);

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
          <div className="platform-icon">
            <ShopifyIcon />
          </div>
          <div className="platform-name">Shopify</div>
          <div className="platform-status">Disponible</div>
        </div>

        <div
          className={`platform-card ${selectedPlatform === 'woocommerce' ? 'selected' : ''}`}
          onClick={() => onSelect('woocommerce')}
        >
          <div className="platform-icon">
            <WooCommerceIcon />
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
