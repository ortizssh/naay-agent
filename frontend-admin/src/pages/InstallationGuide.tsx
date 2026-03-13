import { useState } from 'react';
import logoKova from '../img/kova-logo.svg';

interface InstallationGuideProps {
  onLoginClick: () => void;
}

type Platform = 'woocommerce' | 'shopify';

export default function InstallationGuide({ onLoginClick }: InstallationGuideProps) {
  const [activePlatform, setActivePlatform] = useState<Platform>('woocommerce');

  return (
    <div className="auth-container" style={{ alignItems: 'flex-start', padding: '0' }}>
      <div className="guide-container">
        {/* Header */}
        <div className="guide-header">
          <a href="/" className="sidebar-logo">
            <img src={logoKova} alt="Kova" className="auth-logo-img" style={{ margin: 0 }} />
          </a>
          <button className="btn btn-primary btn-sm" onClick={onLoginClick}>
            Iniciar sesion
          </button>
        </div>

        {/* Title */}
        <div className="guide-title-section">
          <h1>Guia de Instalacion</h1>
          <p>Sigue los pasos para conectar tu tienda con Kova AI y activar el asistente de ventas inteligente.</p>
        </div>

        {/* Platform Tabs */}
        <div className="guide-tabs">
          <button
            className={`guide-tab ${activePlatform === 'woocommerce' ? 'active' : ''}`}
            onClick={() => setActivePlatform('woocommerce')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            WooCommerce
          </button>
          <button
            className={`guide-tab ${activePlatform === 'shopify' ? 'active' : ''}`}
            onClick={() => setActivePlatform('shopify')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Shopify
          </button>
        </div>

        {/* Content */}
        <div className="guide-content">
          {activePlatform === 'woocommerce' ? <WooCommerceGuide /> : <ShopifyGuide />}
        </div>

        {/* Footer */}
        <div className="guide-footer">
          <p>¿Necesitas ayuda? Contactanos en <a href="mailto:support@heykova.io">support@heykova.io</a></p>
        </div>
      </div>
    </div>
  );
}

function WooCommerceGuide() {
  return (
    <div className="guide-steps">
      <div className="guide-note">
        <strong>Requisitos previos:</strong> WordPress 5.8+, WooCommerce 5.0+, PHP 7.4+
      </div>

      <div className="guide-step">
        <div className="guide-step-number">1</div>
        <div className="guide-step-content">
          <h3>Registrate en Kova</h3>
          <p>Crea tu cuenta en <a href="https://app.heykova.io/register" target="_blank" rel="noopener noreferrer">app.heykova.io</a>. Es gratis para comenzar.</p>
        </div>
      </div>

      <div className="guide-step">
        <div className="guide-step-number">2</div>
        <div className="guide-step-content">
          <h3>Selecciona WooCommerce como plataforma</h3>
          <p>Durante el onboarding, elige <strong>WooCommerce</strong> como tu plataforma de e-commerce.</p>
        </div>
      </div>

      <div className="guide-step">
        <div className="guide-step-number">3</div>
        <div className="guide-step-content">
          <h3>Ingresa la URL de tu tienda</h3>
          <p>Escribe la URL completa de tu tienda WordPress (ej: <code>https://mitienda.com</code>).</p>
        </div>
      </div>

      <div className="guide-step">
        <div className="guide-step-number">4</div>
        <div className="guide-step-content">
          <h3>Descarga el plugin</h3>
          <p>Descarga el plugin de Kova para WordPress desde el panel o directamente desde este enlace:</p>
          <a href="/api/woo/plugin/download" className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem', display: 'inline-block' }}>
            Descargar Plugin
          </a>
        </div>
      </div>

      <div className="guide-step">
        <div className="guide-step-number">5</div>
        <div className="guide-step-content">
          <h3>Instala el plugin en WordPress</h3>
          <p>Ve a <strong>WordPress &gt; Plugins &gt; Anadir nuevo &gt; Subir plugin</strong>. Selecciona el archivo ZIP descargado y haz clic en <strong>Instalar ahora</strong>.</p>
        </div>
      </div>

      <div className="guide-step">
        <div className="guide-step-number">6</div>
        <div className="guide-step-content">
          <h3>Activa el plugin</h3>
          <p>Una vez instalado, haz clic en <strong>Activar</strong>. Las claves API se generan automaticamente y la conexion con Kova se establece al instante.</p>
        </div>
      </div>

      <div className="guide-step">
        <div className="guide-step-number">7</div>
        <div className="guide-step-content">
          <h3>Verifica la conexion</h3>
          <p>Ve a <strong>WordPress &gt; WooCommerce &gt; Kova Agent</strong> para confirmar que la conexion esta activa. Tambien puedes verificarlo desde el panel de Kova.</p>
        </div>
      </div>

      <div className="guide-step">
        <div className="guide-step-number">8</div>
        <div className="guide-step-content">
          <h3>Personaliza el widget</h3>
          <p>Desde el panel de Kova, configura los colores, mensajes de bienvenida y comportamiento del chat widget para que coincida con tu marca.</p>
        </div>
      </div>

      <div className="guide-note" style={{ background: 'var(--color-success-soft)', borderLeft: '4px solid var(--color-success)' }}>
        <strong>¡Listo!</strong> El widget de chat aparecera automaticamente en tu tienda. Tus productos se sincronizaran y el asistente IA estara listo para ayudar a tus clientes.
      </div>
    </div>
  );
}

function ShopifyGuide() {
  return (
    <div className="guide-steps">
      <div className="guide-note">
        <strong>Requisitos previos:</strong> Tienda Shopify activa con un plan de pago.
      </div>

      <div className="guide-step">
        <div className="guide-step-number">1</div>
        <div className="guide-step-content">
          <h3>Registrate en Kova</h3>
          <p>Crea tu cuenta en <a href="https://app.heykova.io/register" target="_blank" rel="noopener noreferrer">app.heykova.io</a>. Es gratis para comenzar.</p>
        </div>
      </div>

      <div className="guide-step">
        <div className="guide-step-number">2</div>
        <div className="guide-step-content">
          <h3>Selecciona Shopify como plataforma</h3>
          <p>Durante el onboarding, elige <strong>Shopify</strong> como tu plataforma de e-commerce.</p>
        </div>
      </div>

      <div className="guide-step">
        <div className="guide-step-number">3</div>
        <div className="guide-step-content">
          <h3>Ingresa el nombre de tu tienda</h3>
          <p>Escribe el dominio de tu tienda Shopify (ej: <code>mitienda.myshopify.com</code>).</p>
        </div>
      </div>

      <div className="guide-step">
        <div className="guide-step-number">4</div>
        <div className="guide-step-content">
          <h3>Autoriza la app</h3>
          <p>Seras redirigido a Shopify para autorizar la instalacion de Kova. Acepta los permisos solicitados para que la app pueda acceder a tus productos y pedidos.</p>
        </div>
      </div>

      <div className="guide-step">
        <div className="guide-step-number">5</div>
        <div className="guide-step-content">
          <h3>Configura los datos de tu tienda</h3>
          <p>Completa la informacion basica de tu tienda: nombre, descripcion y datos de contacto.</p>
        </div>
      </div>

      <div className="guide-step">
        <div className="guide-step-number">6</div>
        <div className="guide-step-content">
          <h3>Sincroniza tus productos</h3>
          <p>Kova sincronizara automaticamente tu catalogo de productos. Este proceso puede tomar unos minutos dependiendo del tamano de tu catalogo.</p>
        </div>
      </div>

      <div className="guide-step">
        <div className="guide-step-number">7</div>
        <div className="guide-step-content">
          <h3>Activa el widget en tu tema</h3>
          <p>Ve a <strong>Shopify Admin &gt; Online Store &gt; Themes &gt; Customize</strong>. En el editor del tema, busca <strong>App Blocks</strong> y activa <strong>Kova AI Chat Widget</strong>.</p>
        </div>
      </div>

      <div className="guide-step">
        <div className="guide-step-number">8</div>
        <div className="guide-step-content">
          <h3>Personaliza colores y mensajes</h3>
          <p>Desde el panel de Kova o directamente desde el Theme Editor de Shopify, personaliza los colores y mensajes del widget para que coincida con tu marca.</p>
        </div>
      </div>

      <div className="guide-note" style={{ background: 'var(--color-success-soft)', borderLeft: '4px solid var(--color-success)' }}>
        <strong>¡Listo!</strong> El asistente IA de Kova esta activo en tu tienda Shopify. Tus clientes podran buscar productos, recibir recomendaciones y agregar al carrito directamente desde el chat.
      </div>
    </div>
  );
}
