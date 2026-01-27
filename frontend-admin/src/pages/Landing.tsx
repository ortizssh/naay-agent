import logoKova from '../img/logo-kova.png';

interface LandingProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

export default function Landing({ onLoginClick, onRegisterClick }: LandingProps) {
  return (
    <div className="landing">
      {/* Header */}
      <header className="landing-header">
        <div className="landing-container">
          <div className="landing-logo">
            <img src={logoKova} alt="Kova" className="logo-img" />
          </div>
          <nav className="landing-nav">
            <button onClick={onLoginClick} className="btn btn-ghost">
              Iniciar Sesion
            </button>
            <button onClick={onRegisterClick} className="btn btn-primary">
              Comenzar Gratis
            </button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-container">
          <div className="hero-content">
            <div className="hero-badge">Potenciado por IA</div>
            <h1>Convierte visitantes en clientes con un asistente inteligente</h1>
            <p>
              Kova es un chatbot de IA que entiende tus productos y ayuda a tus
              clientes a encontrar exactamente lo que buscan. Aumenta tus ventas
              mientras duermes.
            </p>
            <div className="hero-actions">
              <button onClick={onRegisterClick} className="btn btn-primary btn-lg">
                Prueba Gratis 14 Dias
              </button>
              <button onClick={onLoginClick} className="btn btn-outline btn-lg">
                Ver Demo
              </button>
            </div>
            <div className="hero-trust">
              <span>Sin tarjeta de credito</span>
              <span>Configuracion en 5 minutos</span>
              <span>Cancela cuando quieras</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-features">
        <div className="landing-container">
          <div className="section-header">
            <h2>Todo lo que necesitas para vender mas</h2>
            <p>Funcionalidades disenadas para tiendas online modernas</p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3>Chat Inteligente</h3>
              <p>
                Responde preguntas sobre productos, stock, envios y mas.
                Disponible 24/7 en tu tienda.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <h3>Busqueda Semantica</h3>
              <p>
                Entiende lo que tus clientes quieren, no solo palabras clave.
                "Algo para el frio" encuentra abrigos.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
              </div>
              <h3>Carrito Inteligente</h3>
              <p>
                Agrega productos al carrito directamente desde el chat.
                Sin fricciones, mas conversiones.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20V10" />
                  <path d="M18 20V4" />
                  <path d="M6 20v-4" />
                </svg>
              </div>
              <h3>Analiticas</h3>
              <p>
                Ve que preguntan tus clientes, que productos buscan y
                como mejorar tu catalogo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta">
        <div className="landing-container">
          <div className="cta-content">
            <h2>Empieza a vender mas hoy</h2>
            <p>
              Unete a cientos de tiendas que ya usan Kova para aumentar sus
              ventas y mejorar la experiencia de sus clientes.
            </p>
            <button onClick={onRegisterClick} className="btn btn-white btn-lg">
              Comenzar Prueba Gratuita
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="footer-content">
            <div className="footer-brand">
              <div className="landing-logo">
                <img src={logoKova} alt="Kova" className="logo-img logo-img-light" />
              </div>
              <p>Asistente de ventas con IA para tu tienda online.</p>
            </div>
            <div className="footer-links">
              <div className="footer-column">
                <h4>Producto</h4>
                <a href="#features">Caracteristicas</a>
                <a href="#pricing">Precios</a>
                <a href="#demo">Demo</a>
              </div>
              <div className="footer-column">
                <h4>Soporte</h4>
                <a href="#docs">Documentacion</a>
                <a href="#contact">Contacto</a>
                <a href="#status">Estado</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2024 Kova. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
