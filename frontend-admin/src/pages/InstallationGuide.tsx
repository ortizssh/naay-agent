import { useState, useEffect, useRef } from 'react';
import logoKova from '../img/kova-logo.svg';

interface InstallationGuideProps {
  onLoginClick: () => void;
}

interface SidebarItem {
  id: string;
  title: string;
  children?: { id: string; title: string }[];
}

const sidebarSections: SidebarItem[] = [
  { id: 'intro', title: 'Introduccion' },
  {
    id: 'woocommerce', title: 'WooCommerce',
    children: [
      { id: 'woo-requisitos', title: 'Requisitos' },
      { id: 'woo-instalacion', title: 'Instalacion' },
      { id: 'woo-configuracion', title: 'Configuracion' },
    ],
  },
  {
    id: 'shopify', title: 'Shopify',
    children: [
      { id: 'shopify-requisitos', title: 'Requisitos' },
      { id: 'shopify-instalacion', title: 'Instalacion' },
      { id: 'shopify-configuracion', title: 'Configuracion' },
    ],
  },
  { id: 'panel', title: 'Panel de Control' },
  { id: 'widget', title: 'Configuracion del Widget' },
  { id: 'ia', title: 'Configuracion de IA' },
  { id: 'knowledge', title: 'Base de Conocimiento' },
  { id: 'analytics', title: 'Analiticas' },
  { id: 'voice', title: 'Agente de Voz' },
  { id: 'planes', title: 'Planes y Facturacion' },
  { id: 'faq', title: 'Preguntas Frecuentes' },
];

function getAllIds(): string[] {
  const ids: string[] = [];
  sidebarSections.forEach(s => {
    ids.push(s.id);
    s.children?.forEach(c => ids.push(c.id));
  });
  return ids;
}

export default function InstallationGuide({ onLoginClick }: InstallationGuideProps) {
  const [activeId, setActiveId] = useState('intro');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const ids = getAllIds();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    );

    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) observerRef.current!.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setSidebarOpen(false);
    }
  };

  const isActive = (id: string) => activeId === id;
  const isParentActive = (item: SidebarItem) =>
    activeId === item.id || (item.children?.some(c => c.id === activeId) ?? false);

  return (
    <div className="docs-page">
      {/* Header */}
      <header className="docs-header">
        <a href="/" className="docs-header-logo">
          <img src={logoKova} alt="Kova" />
        </a>
        <div className="docs-header-actions">
          <button className="docs-mobile-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {sidebarOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
          <button className="btn btn-primary btn-sm" onClick={onLoginClick}>
            Iniciar sesion
          </button>
        </div>
      </header>

      <div className="docs-layout">
        {/* Sidebar */}
        <aside className={`docs-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <nav className="docs-sidebar-nav">
            {sidebarSections.map(item => (
              <div key={item.id}>
                <button
                  className={`docs-sidebar-item ${isParentActive(item) ? 'active' : ''}`}
                  onClick={() => scrollTo(item.id)}
                >
                  {item.title}
                </button>
                {item.children && (
                  <div className="docs-sidebar-children">
                    {item.children.map(child => (
                      <button
                        key={child.id}
                        className={`docs-sidebar-item docs-sidebar-subitem ${isActive(child.id) ? 'active' : ''}`}
                        onClick={() => scrollTo(child.id)}
                      >
                        {child.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="docs-main">
          {/* Introduccion */}
          <section id="intro" className="docs-section">
            <h1>Documentacion de Kova</h1>
            <p className="docs-intro-text">
              Kova es un asistente de comercio con inteligencia artificial que se integra con tu tienda online.
              Ayuda a tus clientes a encontrar productos, recibir recomendaciones personalizadas y gestionar
              su carrito de compras directamente desde un chat conversacional.
            </p>
            <div className="docs-features-grid">
              <div className="docs-feature-card">
                <h3>Multi-plataforma</h3>
                <p>Compatible con WooCommerce y Shopify. Conecta tu tienda en minutos.</p>
              </div>
              <div className="docs-feature-card">
                <h3>Busqueda semantica</h3>
                <p>Los clientes encuentran productos describiendo lo que buscan con lenguaje natural.</p>
              </div>
              <div className="docs-feature-card">
                <h3>Carrito inteligente</h3>
                <p>Agrega productos al carrito directamente desde la conversacion.</p>
              </div>
              <div className="docs-feature-card">
                <h3>Personalizable</h3>
                <p>Adapta colores, mensajes y comportamiento del widget a tu marca.</p>
              </div>
            </div>
          </section>

          {/* WooCommerce */}
          <section id="woocommerce" className="docs-section">
            <h2>Instalacion en WooCommerce</h2>
            <p>Conecta tu tienda WooCommerce con Kova siguiendo estos pasos.</p>

            <div id="woo-requisitos" className="docs-subsection">
              <h3>Requisitos</h3>
              <ul>
                <li>WordPress 5.8 o superior</li>
                <li>WooCommerce 5.0 o superior</li>
                <li>PHP 7.4 o superior</li>
                <li>Certificado SSL activo (HTTPS)</li>
              </ul>
            </div>

            <div id="woo-instalacion" className="docs-subsection">
              <h3>Instalacion</h3>
              <ol>
                <li>
                  <strong>Registrate en Kova</strong> — Crea tu cuenta en{' '}
                  <a href="https://app.heykova.io/register" target="_blank" rel="noopener noreferrer">app.heykova.io</a>.
                  Es gratis para comenzar.
                </li>
                <li>
                  <strong>Selecciona WooCommerce</strong> — Durante el onboarding, elige WooCommerce como tu plataforma.
                </li>
                <li>
                  <strong>Ingresa la URL de tu tienda</strong> — Escribe la URL completa (ej: <code>https://mitienda.com</code>).
                </li>
                <li>
                  <strong>Descarga el plugin</strong> — Descarga el plugin desde el panel de Kova o directamente aqui:
                  <br />
                  <a href="/api/woo/plugin/download" className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem', display: 'inline-block' }}>
                    Descargar Plugin
                  </a>
                </li>
                <li>
                  <strong>Instala en WordPress</strong> — Ve a <strong>Plugins &gt; Anadir nuevo &gt; Subir plugin</strong>.
                  Selecciona el archivo ZIP descargado y haz clic en <strong>Instalar ahora</strong>.
                </li>
                <li>
                  <strong>Activa el plugin</strong> — Haz clic en <strong>Activar</strong>.
                  Las claves API se generan automaticamente y la conexion se establece al instante.
                </li>
              </ol>
            </div>

            <div id="woo-configuracion" className="docs-subsection">
              <h3>Configuracion</h3>
              <ol>
                <li>
                  Ve a <strong>WordPress &gt; WooCommerce &gt; Kova Agent</strong> para verificar que la conexion esta activa.
                </li>
                <li>
                  Desde el panel de Kova, personaliza los colores, mensajes de bienvenida y comportamiento del widget.
                </li>
                <li>
                  El widget aparecera automaticamente en tu tienda. Tus productos se sincronizaran y el asistente estara listo.
                </li>
              </ol>
              <div className="docs-callout docs-callout-success">
                <strong>Listo!</strong> El widget de chat aparecera automaticamente en tu tienda WooCommerce.
              </div>
            </div>
          </section>

          {/* Shopify */}
          <section id="shopify" className="docs-section">
            <h2>Instalacion en Shopify</h2>
            <p>Conecta tu tienda Shopify con Kova siguiendo estos pasos.</p>

            <div id="shopify-requisitos" className="docs-subsection">
              <h3>Requisitos</h3>
              <ul>
                <li>Tienda Shopify activa con un plan de pago</li>
                <li>Acceso de administrador a la tienda</li>
              </ul>
            </div>

            <div id="shopify-instalacion" className="docs-subsection">
              <h3>Instalacion</h3>
              <ol>
                <li>
                  <strong>Registrate en Kova</strong> — Crea tu cuenta en{' '}
                  <a href="https://app.heykova.io/register" target="_blank" rel="noopener noreferrer">app.heykova.io</a>.
                </li>
                <li>
                  <strong>Selecciona Shopify</strong> — Elige Shopify como plataforma durante el onboarding.
                </li>
                <li>
                  <strong>Ingresa tu dominio</strong> — Escribe el dominio de tu tienda (ej: <code>mitienda.myshopify.com</code>).
                </li>
                <li>
                  <strong>Autoriza la app</strong> — Seras redirigido a Shopify para aceptar los permisos necesarios.
                </li>
                <li>
                  <strong>Sincroniza productos</strong> — Kova sincronizara automaticamente tu catalogo.
                  Puede tomar unos minutos dependiendo del tamano.
                </li>
              </ol>
            </div>

            <div id="shopify-configuracion" className="docs-subsection">
              <h3>Configuracion</h3>
              <ol>
                <li>
                  Ve a <strong>Shopify Admin &gt; Online Store &gt; Themes &gt; Customize</strong>.
                </li>
                <li>
                  En el editor del tema, busca <strong>App Blocks</strong> y activa <strong>Kova AI Chat Widget</strong>.
                </li>
                <li>
                  Personaliza colores y mensajes desde el panel de Kova o directamente desde el Theme Editor de Shopify.
                </li>
              </ol>
              <div className="docs-callout docs-callout-success">
                <strong>Listo!</strong> El asistente IA esta activo en tu tienda Shopify.
              </div>
            </div>
          </section>

          {/* Panel de Control */}
          <section id="panel" className="docs-section">
            <h2>Panel de Control</h2>
            <p>
              El panel de Kova te permite gestionar todos los aspectos de tu asistente desde un solo lugar.
            </p>
            <h3>Dashboard</h3>
            <p>
              Al iniciar sesion veras un resumen con las metricas principales de tu tienda:
            </p>
            <ul>
              <li><strong>Conversaciones activas</strong> — Numero de chats en curso</li>
              <li><strong>Mensajes del mes</strong> — Cantidad de respuestas IA generadas en el periodo actual</li>
              <li><strong>Productos sincronizados</strong> — Total de productos indexados y disponibles para busqueda</li>
              <li><strong>Estado de conexion</strong> — Verifica que tu tienda este correctamente conectada</li>
            </ul>
            <h3>Sincronizacion de productos</h3>
            <p>
              Kova sincroniza automaticamente tu catalogo de productos. Puedes forzar una sincronizacion manual
              desde el panel si has realizado cambios recientes en tu tienda.
            </p>
          </section>

          {/* Widget */}
          <section id="widget" className="docs-section">
            <h2>Configuracion del Widget</h2>
            <p>
              Personaliza la apariencia y comportamiento del chat widget que aparece en tu tienda.
            </p>

            <h3>Apariencia</h3>
            <ul>
              <li><strong>Color primario</strong> — Color principal del widget y los botones</li>
              <li><strong>Color secundario</strong> — Color de acentos y elementos secundarios</li>
              <li><strong>Posicion</strong> — Esquina inferior derecha o izquierda</li>
              <li><strong>Tamano del boton</strong> — Ajusta el tamano del boton flotante</li>
              <li><strong>Estilo del borde</strong> — Redondeado o cuadrado</li>
            </ul>

            <h3>Contenido</h3>
            <ul>
              <li><strong>Mensaje de bienvenida</strong> — Texto que ve el cliente al abrir el chat</li>
              <li><strong>Placeholder</strong> — Texto de ejemplo en el campo de entrada</li>
              <li><strong>Avatar</strong> — Imagen del asistente en el chat</li>
              <li><strong>Nombre del asistente</strong> — Nombre que aparece en el encabezado del widget</li>
            </ul>

            <h3>Funciones</h3>
            <ul>
              <li><strong>Carrito</strong> — Permitir agregar productos al carrito desde el chat</li>
              <li><strong>Animacion</strong> — Animacion de apertura del widget</li>
              <li><strong>Badge de notificacion</strong> — Indicador visual en el boton flotante</li>
              <li><strong>Boton de contacto</strong> — Mostrar enlace a email o WhatsApp</li>
            </ul>
          </section>

          {/* IA */}
          <section id="ia" className="docs-section">
            <h2>Configuracion de IA</h2>
            <p>Controla como se comporta el asistente inteligente en las conversaciones.</p>

            <h3>Modo de operacion</h3>
            <ul>
              <li>
                <strong>Interno (recomendado)</strong> — Kova usa su propia IA para responder.
                No necesitas configurar nada adicional.
              </li>
              <li>
                <strong>Externo</strong> — Conecta tu propio endpoint de chatbot.
                Util si ya tienes un modelo entrenado.
              </li>
            </ul>

            <h3>Personalizacion</h3>
            <ul>
              <li><strong>Nombre del agente</strong> — Como se presenta el asistente</li>
              <li><strong>Tono</strong> — Formal, casual o amigable</li>
              <li><strong>Idioma</strong> — Idioma principal de las respuestas</li>
              <li><strong>Instrucciones personalizadas</strong> — Indicaciones especificas para el comportamiento del agente</li>
              <li><strong>Descripcion de marca</strong> — Contexto sobre tu negocio para respuestas mas relevantes</li>
            </ul>
          </section>

          {/* Knowledge Base */}
          <section id="knowledge" className="docs-section">
            <h2>Base de Conocimiento</h2>
            <p>
              Sube documentos con informacion sobre tu negocio para que el asistente responda
              preguntas mas alla del catalogo de productos.
            </p>

            <h3>Formatos soportados</h3>
            <ul>
              <li>PDF (hasta 10MB)</li>
              <li>Texto plano (.txt)</li>
              <li>Markdown (.md)</li>
            </ul>

            <h3>Como funciona</h3>
            <ol>
              <li>Sube un documento desde la seccion <strong>Base de Conocimiento</strong> del panel</li>
              <li>Kova procesa y divide el documento en fragmentos optimizados</li>
              <li>Se generan embeddings semanticos para busqueda inteligente</li>
              <li>El asistente usa estos fragmentos para responder preguntas de los clientes</li>
            </ol>

            <h3>Estados de procesamiento</h3>
            <ul>
              <li><strong>Procesando</strong> — El documento esta siendo analizado</li>
              <li><strong>Activo</strong> — Listo para ser usado en las conversaciones</li>
              <li><strong>Error</strong> — Hubo un problema al procesar el documento</li>
            </ul>
          </section>

          {/* Analytics */}
          <section id="analytics" className="docs-section">
            <h2>Analiticas y Conversiones</h2>
            <p>
              Mide el impacto del asistente en tus ventas con metricas detalladas.
            </p>

            <h3>Metricas disponibles</h3>
            <ul>
              <li><strong>Conversaciones totales</strong> — Numero de chats iniciados</li>
              <li><strong>Tasa de conversion</strong> — Porcentaje de conversaciones que resultan en compra</li>
              <li><strong>Ingresos atribuidos</strong> — Ventas generadas con asistencia del chat</li>
              <li><strong>Productos mas recomendados</strong> — Productos con mas interacciones</li>
            </ul>

            <h3>Tipos de atribucion</h3>
            <ul>
              <li><strong>Directa</strong> — El cliente compro un producto recomendado en el chat</li>
              <li><strong>Asistida</strong> — El cliente interactuo con el chat antes de comprar</li>
              <li><strong>View-through</strong> — El cliente vio productos en el chat y compro despues</li>
            </ul>

            <h3>Periodos</h3>
            <p>
              Filtra las metricas por periodos: hoy, ultimos 7 dias, 30 dias o rango personalizado.
            </p>
          </section>

          {/* Voice */}
          <section id="voice" className="docs-section">
            <h2>Agente de Voz</h2>
            <p>
              Permite a tus clientes interactuar con el asistente por voz, ademas del texto.
            </p>

            <div className="docs-callout">
              <strong>Nota:</strong> El agente de voz esta disponible en los planes Professional y Enterprise.
            </div>

            <h3>Configuracion</h3>
            <ul>
              <li><strong>Voz</strong> — Selecciona entre diferentes voces disponibles</li>
              <li><strong>Idioma</strong> — Idioma de reconocimiento y respuesta por voz</li>
              <li><strong>Velocidad</strong> — Ajusta la velocidad de habla del asistente</li>
              <li><strong>Prompt de voz</strong> — Instrucciones especificas para el modo de voz</li>
            </ul>

            <h3>Funciones</h3>
            <ul>
              <li>Historial de llamadas con transcripcion</li>
              <li>Llamada de prueba desde el panel</li>
              <li>Metricas de uso de voz</li>
            </ul>
          </section>

          {/* Planes */}
          <section id="planes" className="docs-section">
            <h2>Planes y Facturacion</h2>
            <p>Elige el plan que mejor se adapte a tu negocio.</p>

            <div className="docs-plans-table-wrapper">
              <table className="docs-plans-table">
                <thead>
                  <tr>
                    <th>Caracteristica</th>
                    <th>Free</th>
                    <th>Starter</th>
                    <th>Professional</th>
                    <th>Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Productos</td>
                    <td>50</td>
                    <td>500</td>
                    <td>5,000</td>
                    <td>Ilimitados</td>
                  </tr>
                  <tr>
                    <td>Mensajes/mes</td>
                    <td>100</td>
                    <td>1,000</td>
                    <td>10,000</td>
                    <td>Ilimitados</td>
                  </tr>
                  <tr>
                    <td>Analiticas</td>
                    <td>Basicas</td>
                    <td>Basicas</td>
                    <td>Avanzadas</td>
                    <td>Avanzadas</td>
                  </tr>
                  <tr>
                    <td>Base de conocimiento</td>
                    <td>—</td>
                    <td>1 doc</td>
                    <td>10 docs</td>
                    <td>Ilimitados</td>
                  </tr>
                  <tr>
                    <td>Agente de voz</td>
                    <td>—</td>
                    <td>—</td>
                    <td>Si</td>
                    <td>Si</td>
                  </tr>
                  <tr>
                    <td>Soporte</td>
                    <td>Email</td>
                    <td>Email</td>
                    <td>Prioritario</td>
                    <td>Dedicado</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3>Gestion de suscripcion</h3>
            <p>
              La facturacion se gestiona a traves de Stripe. Desde el panel puedes:
            </p>
            <ul>
              <li>Cambiar de plan en cualquier momento</li>
              <li>Ver el historial de pagos</li>
              <li>Actualizar tu metodo de pago</li>
              <li>Cancelar la suscripcion</li>
            </ul>
          </section>

          {/* FAQ */}
          <section id="faq" className="docs-section">
            <h2>Preguntas Frecuentes</h2>

            <div className="docs-faq-item">
              <h3>¿Necesito conocimientos tecnicos para instalar Kova?</h3>
              <p>No. El proceso de instalacion esta disenado para ser sencillo. En WooCommerce solo necesitas instalar un plugin, y en Shopify se configura desde el Theme Editor.</p>
            </div>

            <div className="docs-faq-item">
              <h3>¿Cuanto tarda la sincronizacion de productos?</h3>
              <p>Depende del tamano de tu catalogo. Generalmente toma entre 1 y 5 minutos para catalogos de hasta 1,000 productos.</p>
            </div>

            <div className="docs-faq-item">
              <h3>¿Puedo personalizar las respuestas del asistente?</h3>
              <p>Si. Puedes configurar el tono, idioma, instrucciones personalizadas y subir documentos a la base de conocimiento para respuestas mas especificas.</p>
            </div>

            <div className="docs-faq-item">
              <h3>¿El widget afecta la velocidad de mi tienda?</h3>
              <p>No. El widget se carga de forma asincrona y no bloquea la carga de tu pagina. Su impacto en el rendimiento es minimo.</p>
            </div>

            <div className="docs-faq-item">
              <h3>¿Puedo usar Kova en mas de una tienda?</h3>
              <p>Si. Cada tienda requiere su propia cuenta y plan. Puedes gestionar multiples tiendas desde cuentas separadas.</p>
            </div>

            <div className="docs-faq-item">
              <h3>¿Que pasa si alcanzo el limite de mensajes de mi plan?</h3>
              <p>El asistente dejara de responder hasta el siguiente periodo de facturacion. Puedes actualizar tu plan en cualquier momento para obtener mas mensajes.</p>
            </div>

            <div className="docs-faq-item">
              <h3>¿Como cancelo mi suscripcion?</h3>
              <p>Desde el panel de Kova, ve a <strong>Suscripcion</strong> y haz clic en <strong>Gestionar suscripcion</strong>. Seras redirigido al portal de Stripe donde puedes cancelar.</p>
            </div>
          </section>

          {/* Footer */}
          <footer className="docs-footer">
            <p>¿Necesitas ayuda? Contactanos en <a href="mailto:support@heykova.io">support@heykova.io</a></p>
          </footer>
        </main>
      </div>
    </div>
  );
}
