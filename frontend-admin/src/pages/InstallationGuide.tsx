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

/* ── Step Indicator ── */
const StepNumber = ({ n }: { n: number }) => (
  <span className="docs-step-number" aria-hidden="true">{n}</span>
);

/* ── Callout boxes ── */
const TipBox = ({ children }: { children: React.ReactNode }) => (
  <aside className="docs-callout docs-callout-tip" role="note" aria-label="Consejo">
    <svg className="docs-callout-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="10" cy="10" r="8" />
      <path d="M10 6v5M10 13.5v.5" strokeWidth="2" strokeLinecap="round" />
    </svg>
    <div>{children}</div>
  </aside>
);

const WarningBox = ({ children }: { children: React.ReactNode }) => (
  <aside className="docs-callout docs-callout-warning" role="note" aria-label="Advertencia">
    <svg className="docs-callout-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M10 2L1 18h18L10 2z" />
      <path d="M10 8v4M10 14.5v.5" strokeWidth="2" strokeLinecap="round" />
    </svg>
    <div>{children}</div>
  </aside>
);

const SEO_TITLE = 'Documentacion de Kova — Asistente IA para WooCommerce y Shopify';
const SEO_DESCRIPTION = 'Guia completa para instalar y configurar Kova, el asistente de ventas con inteligencia artificial para tiendas WooCommerce y Shopify. Busqueda semantica, carrito inteligente, analiticas de conversion y agente de voz.';
const SEO_URL = 'https://app.heykova.io/docs';

const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: SEO_TITLE,
  description: SEO_DESCRIPTION,
  url: SEO_URL,
  inLanguage: 'es',
  author: { '@type': 'Organization', name: 'Kova', url: 'https://heykova.io' },
  publisher: { '@type': 'Organization', name: 'Kova', url: 'https://heykova.io' },
  mainEntityOfPage: { '@type': 'WebPage', '@id': SEO_URL },
  about: [
    { '@type': 'SoftwareApplication', name: 'Kova', applicationCategory: 'BusinessApplication', operatingSystem: 'Web' },
  ],
};

const FAQ_STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'Necesito conocimientos tecnicos para instalar Kova?', acceptedAnswer: { '@type': 'Answer', text: 'No. En WooCommerce solo necesitas instalar un plugin ZIP y las claves API se generan automaticamente. En Shopify se configura desde el Theme Editor.' } },
    { '@type': 'Question', name: 'Cuanto tarda la sincronizacion de productos?', acceptedAnswer: { '@type': 'Answer', text: 'Aproximadamente 1 minuto para 100 productos, 3 minutos para 500 y 5 minutos para 1,000. Incluye generacion de embeddings semanticos.' } },
    { '@type': 'Question', name: 'El widget afecta la velocidad de carga de mi tienda?', acceptedAnswer: { '@type': 'Answer', text: 'No. El widget se carga de forma asincrona y no bloquea el renderizado de la pagina. El impacto es minimo (menos de 100ms).' } },
    { '@type': 'Question', name: 'Puedo personalizar las respuestas del asistente?', acceptedAnswer: { '@type': 'Answer', text: 'Si. Puedes configurar el tono, idioma, instrucciones personalizadas, descripcion de marca, modelo de IA y subir documentos a la base de conocimiento.' } },
    { '@type': 'Question', name: 'Puedo conectar mi propio chatbot o IA personalizada?', acceptedAnswer: { '@type': 'Answer', text: 'Si. En modo Endpoint Externo puedes conectar cualquier servicio que acepte HTTP POST (n8n, Dialogflow, API custom). Kova maneja el widget y la interfaz.' } },
    { '@type': 'Question', name: 'Que planes ofrece Kova?', acceptedAnswer: { '@type': 'Answer', text: 'Free (50 productos, 100 mensajes/mes), Starter (500 productos, 1000 mensajes), Professional (5000 productos, 10000 mensajes, voz), Enterprise (ilimitado).' } },
  ],
};

export default function InstallationGuide({ onLoginClick }: InstallationGuideProps) {
  const [activeId, setActiveId] = useState('intro');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // SEO: set meta tags and structured data
  useEffect(() => {
    document.title = SEO_TITLE;

    const setMeta = (name: string, content: string, attr = 'name') => {
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('description', SEO_DESCRIPTION);
    setMeta('robots', 'index, follow');
    setMeta('og:title', SEO_TITLE, 'property');
    setMeta('og:description', SEO_DESCRIPTION, 'property');
    setMeta('og:url', SEO_URL, 'property');
    setMeta('og:type', 'article', 'property');
    setMeta('og:site_name', 'Kova', 'property');
    setMeta('og:locale', 'es_ES', 'property');
    setMeta('twitter:card', 'summary');
    setMeta('twitter:title', SEO_TITLE);
    setMeta('twitter:description', SEO_DESCRIPTION);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', SEO_URL);

    // Structured data
    const addJsonLd = (data: object, id: string) => {
      let script = document.getElementById(id) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = id;
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(data);
    };
    addJsonLd(STRUCTURED_DATA, 'ld-article');
    addJsonLd(FAQ_STRUCTURED_DATA, 'ld-faq');

    return () => {
      document.getElementById('ld-article')?.remove();
      document.getElementById('ld-faq')?.remove();
      document.querySelector('link[rel="canonical"]')?.remove();
    };
  }, []);

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
        <aside className={`docs-sidebar ${sidebarOpen ? 'open' : ''}`} role="complementary">
          <nav className="docs-sidebar-nav" aria-label="Tabla de contenidos">
            {sidebarSections.map(item => (
              <div key={item.id}>
                <button
                  className={`docs-sidebar-item ${isParentActive(item) ? 'active' : ''}`}
                  onClick={() => scrollTo(item.id)}
                  aria-current={isParentActive(item) ? 'true' : undefined}
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
                        aria-current={isActive(child.id) ? 'true' : undefined}
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
        <main className="docs-main" role="main" aria-label="Contenido de documentacion">

          {/* ════════════════ Introduccion ════════════════ */}
          <section id="intro" className="docs-section">
            <h1>Documentacion de Kova</h1>
            <p className="docs-intro-text">
              Kova es un asistente de comercio conversacional impulsado por inteligencia artificial.
              Se integra directamente con tu tienda online — ya sea WooCommerce o Shopify — y permite a tus
              clientes buscar productos, recibir recomendaciones personalizadas, resolver dudas y gestionar
              su carrito de compras, todo desde una ventana de chat embebida en tu sitio.
            </p>
            <p>
              A diferencia de un chatbot generico, Kova tiene acceso en tiempo real a tu catalogo de productos,
              precios, variantes e inventario. Utiliza busqueda semantica con vectores (pgvector) para que los clientes
              encuentren lo que necesitan describiendo con sus propias palabras lo que buscan, sin depender de
              coincidencias exactas de texto.
            </p>

            <h3>Que puede hacer Kova por tu tienda</h3>
            <div className="docs-features-grid">
              <div className="docs-feature-card">
                <h3>Multi-plataforma</h3>
                <p>Compatible con WooCommerce y Shopify. La integracion normaliza ambas plataformas
                  detras de una interfaz unificada, asi que la experiencia del cliente es identica
                  independientemente de tu plataforma.</p>
              </div>
              <div className="docs-feature-card">
                <h3>Busqueda semantica</h3>
                <p>Los clientes describen lo que buscan con lenguaje natural — por ejemplo,
                  &quot;algo para regalar a mi mama&quot; o &quot;zapatos comodos para caminar&quot; — y Kova
                  encuentra los productos mas relevantes usando embeddings de OpenAI.</p>
              </div>
              <div className="docs-feature-card">
                <h3>Carrito inteligente</h3>
                <p>Los clientes pueden agregar productos al carrito directamente desde la conversacion,
                  seleccionar variantes (talla, color) y proceder al checkout sin salir del chat.</p>
              </div>
              <div className="docs-feature-card">
                <h3>Totalmente personalizable</h3>
                <p>Adapta colores, mensajes, tono de voz, idioma, modelo de IA y comportamiento
                  del widget para que se sienta como una extension natural de tu marca.</p>
              </div>
              <div className="docs-feature-card">
                <h3>Base de conocimiento</h3>
                <p>Sube documentos (PDF, TXT, Markdown) con informacion de tu negocio — politicas
                  de envio, devoluciones, guias de tallas — para que la IA responda preguntas
                  mas alla del catalogo.</p>
              </div>
              <div className="docs-feature-card">
                <h3>Analiticas de conversion</h3>
                <p>Mide el impacto real del asistente en tus ventas con metricas de conversion,
                  atribucion directa/asistida/view-through, y ranking de productos mas recomendados.</p>
              </div>
            </div>

            <h3>Como funciona</h3>
            <p>
              El flujo general es simple: conectas tu tienda, Kova sincroniza tu catalogo de productos
              y genera embeddings semanticos para cada uno. Cuando un cliente abre el chat en tu sitio,
              puede hacer preguntas en lenguaje natural. La IA busca los productos mas relevantes,
              los presenta con imagenes y precios, y el cliente puede agregarlos al carrito sin salir
              de la conversacion.
            </p>
            <p>
              Ademas del catalogo, la IA tiene acceso a la base de conocimiento que configures (documentos
              con informacion de tu negocio) y a las instrucciones personalizadas que definas (tono,
              restricciones, comportamiento). Todo esto se combina para generar respuestas contextualizadas
              y relevantes para cada cliente.
            </p>

            <TipBox>
              <strong>Nuevo en Kova?</strong> El proceso completo de configuracion toma menos de 5 minutos.
              Registrate gratis en <a href="https://app.heykova.io/register" target="_blank" rel="noopener noreferrer">app.heykova.io</a> y
              sigue el asistente de onboarding paso a paso. El plan Free incluye 50 productos y 100 mensajes al mes
              para que puedas probar todas las funcionalidades.
            </TipBox>

            <h3>Multimodal: audio e imagenes</h3>
            <p>
              El chat soporta entrada multimodal. Los clientes pueden enviar mensajes de voz (que se transcriben
              automaticamente con Whisper de OpenAI) e imagenes (que se almacenan en Supabase Storage).
              Formatos de audio soportados: WebM, MP4, OGG y WAV (hasta 5MB). Formatos de imagen: JPEG, PNG,
              WebP y GIF (hasta 2MB).
            </p>
          </section>

          {/* ════════════════ WooCommerce ════════════════ */}
          <section id="woocommerce" className="docs-section">
            <h2>Instalacion en WooCommerce</h2>
            <p>
              La integracion con WooCommerce funciona a traves de un plugin de WordPress que conecta tu tienda
              con Kova. El plugin genera automaticamente las claves API necesarias (Consumer Key y Consumer Secret)
              y registra webhooks para mantener tu catalogo sincronizado en tiempo real.
            </p>

            <div id="woo-requisitos" className="docs-subsection">
              <h3>Requisitos previos</h3>
              <ul>
                <li><strong>WordPress 5.8</strong> o superior</li>
                <li><strong>WooCommerce 5.0</strong> o superior</li>
                <li><strong>PHP 7.4</strong> o superior</li>
                <li><strong>Certificado SSL activo (HTTPS)</strong> — obligatorio para la comunicacion segura entre el plugin y los servidores de Kova</li>
                <li><strong>Permisos de administrador</strong> en WordPress para instalar plugins</li>
              </ul>
              <WarningBox>
                Tu sitio <strong>debe usar HTTPS</strong>. La API de WooCommerce requiere conexiones seguras
                para la autenticacion OAuth. Si tu sitio no tiene SSL, el plugin no podra establecer la conexion.
              </WarningBox>
            </div>

            <div id="woo-instalacion" className="docs-subsection">
              <h3>Proceso de instalacion</h3>
              <div className="docs-steps">
                <div className="docs-step">
                  <StepNumber n={1} />
                  <div>
                    <strong>Crea tu cuenta en Kova</strong> — Registrate en{' '}
                    <a href="https://app.heykova.io/register" target="_blank" rel="noopener noreferrer">app.heykova.io</a>.
                    El plan Free es gratuito e incluye 50 productos y 100 mensajes al mes. No se requiere tarjeta de credito.
                  </div>
                </div>
                <div className="docs-step">
                  <StepNumber n={2} />
                  <div>
                    <strong>Selecciona WooCommerce como plataforma</strong> — Durante el onboarding (paso 1 de 6),
                    elige WooCommerce. El asistente te guiara por los siguientes pasos.
                  </div>
                </div>
                <div className="docs-step">
                  <StepNumber n={3} />
                  <div>
                    <strong>Ingresa la URL de tu tienda</strong> — Escribe la URL completa de tu sitio WordPress
                    (ej: <code>https://mitienda.com</code>). Usa solo el dominio principal, sin rutas adicionales.
                    Kova usa esta URL para identificar tu tienda en todas las comunicaciones.
                  </div>
                </div>
                <div className="docs-step">
                  <StepNumber n={4} />
                  <div>
                    <strong>Descarga el plugin de Kova</strong> — Puedes descargarlo desde el panel durante el onboarding
                    o directamente desde este enlace:
                    <br />
                    <a href="/api/woo/plugin/download" className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem', display: 'inline-block' }}>
                      Descargar Plugin
                    </a>
                    <br />
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                      El archivo es un ZIP listo para instalar en WordPress.
                    </span>
                  </div>
                </div>
                <div className="docs-step">
                  <StepNumber n={5} />
                  <div>
                    <strong>Instala el plugin en WordPress</strong> — En tu panel de WordPress, ve a{' '}
                    <strong>Plugins &gt; Anadir nuevo &gt; Subir plugin</strong>. Selecciona el archivo ZIP
                    descargado y haz clic en <strong>Instalar ahora</strong>.
                  </div>
                </div>
                <div className="docs-step">
                  <StepNumber n={6} />
                  <div>
                    <strong>Activa el plugin</strong> — Una vez instalado, haz clic en <strong>Activar</strong>.
                    Al activarse, el plugin realiza automaticamente tres acciones:
                    <ul style={{ marginTop: '0.5rem' }}>
                      <li>Genera las claves API de WooCommerce (Consumer Key y Consumer Secret)</li>
                      <li>Registra webhooks para sincronizacion de productos y pedidos</li>
                      <li>Inyecta el widget de chat en el frontend de tu tienda</li>
                    </ul>
                  </div>
                </div>
              </div>

              <TipBox>
                <strong>Actualizaciones automaticas:</strong> Kova gestiona las actualizaciones del plugin remotamente.
                Cuando hay una nueva version disponible, WordPress te notificara como con cualquier otro plugin.
              </TipBox>
            </div>

            <div id="woo-configuracion" className="docs-subsection">
              <h3>Verificacion y configuracion</h3>
              <div className="docs-steps">
                <div className="docs-step">
                  <StepNumber n={1} />
                  <div>
                    <strong>Verifica la conexion</strong> — Ve a <strong>WordPress &gt; WooCommerce &gt; Kova Agent</strong>.
                    Aqui veras el estado de la conexion, las claves API generadas y la URL del servidor de Kova.
                    El indicador debe mostrar &quot;Conectado&quot;.
                  </div>
                </div>
                <div className="docs-step">
                  <StepNumber n={2} />
                  <div>
                    <strong>Sincronizacion de productos</strong> — Kova sincroniza automaticamente tu catalogo al conectarse.
                    El tiempo depende del tamano: ~1 minuto para 100 productos, ~5 minutos para 1,000.
                    El proceso incluye la generacion de embeddings semanticos para cada producto.
                  </div>
                </div>
                <div className="docs-step">
                  <StepNumber n={3} />
                  <div>
                    <strong>Personaliza el widget</strong> — Desde el panel de Kova, configura los colores,
                    mensajes de bienvenida, tono del asistente y demas opciones (ver secciones Widget y IA mas abajo).
                  </div>
                </div>
                <div className="docs-step">
                  <StepNumber n={4} />
                  <div>
                    <strong>Verifica en tu tienda</strong> — Visita tu tienda como cliente y verifica que el widget
                    de chat aparece en la esquina inferior derecha (posicion por defecto). Haz una pregunta de prueba
                    para confirmar que la IA responde correctamente.
                  </div>
                </div>
              </div>

              <div className="docs-callout docs-callout-success">
                <strong>Listo!</strong> El widget de chat aparece automaticamente en todas las paginas de tu tienda WooCommerce.
                Los webhooks mantienen el catalogo sincronizado: cuando creas, editas o eliminas un producto en WooCommerce,
                los cambios se reflejan automaticamente en Kova.
              </div>

              <h3>Webhooks automaticos</h3>
              <p>
                El plugin registra los siguientes webhooks que se ejecutan automaticamente:
              </p>
              <ul>
                <li><strong>Producto creado</strong> — Se indexa el nuevo producto y se generan sus embeddings</li>
                <li><strong>Producto actualizado</strong> — Se actualizan los datos y se regeneran los embeddings si cambio el titulo o descripcion</li>
                <li><strong>Producto eliminado</strong> — Se elimina del indice de busqueda</li>
                <li><strong>Pedido completado</strong> — Se usa para atribucion de conversiones y analiticas</li>
              </ul>

              <h3>Solucion de problemas</h3>
              <ul>
                <li><strong>El widget no aparece</strong> — Verifica que el plugin esta activo en WordPress &gt; Plugins. Revisa que no haya conflictos con plugins de cache (purga la cache despues de activar).</li>
                <li><strong>Conexion fallida</strong> — Confirma que tu sitio usa HTTPS y que las claves API son validas en WooCommerce &gt; Kova Agent. Prueba desactivar y reactivar el plugin.</li>
                <li><strong>Productos no sincronizados</strong> — Puedes forzar una sincronizacion manual desde el panel de Kova en la seccion Mi Tienda &gt; Sincronizar productos.</li>
              </ul>
            </div>
          </section>

          {/* ════════════════ Shopify ════════════════ */}
          <section id="shopify" className="docs-section">
            <h2>Instalacion en Shopify</h2>
            <p>
              La integracion con Shopify utiliza el flujo OAuth estandar de Shopify. Al autorizar la app,
              Kova obtiene acceso a tu catalogo de productos y pedidos a traves de la Admin API y la Storefront API.
              El widget se instala como un App Block en tu tema, lo que te da control total desde el Theme Editor.
            </p>

            <div id="shopify-requisitos" className="docs-subsection">
              <h3>Requisitos previos</h3>
              <ul>
                <li><strong>Tienda Shopify activa</strong> con un plan de pago (Basic, Shopify, Advanced o Plus)</li>
                <li><strong>Acceso de administrador</strong> a la tienda</li>
                <li><strong>Tema compatible con App Blocks</strong> — La mayoria de temas modernos de Shopify (Online Store 2.0) los soportan. Temas clasicos pueden requerir edicion manual del codigo del tema.</li>
              </ul>
              <TipBox>
                Shopify identifica tu tienda por el dominio <code>*.myshopify.com</code>. Aunque uses un
                dominio personalizado, internamente Kova siempre usa el dominio myshopify.com como identificador unico.
              </TipBox>
            </div>

            <div id="shopify-instalacion" className="docs-subsection">
              <h3>Proceso de instalacion</h3>
              <div className="docs-steps">
                <div className="docs-step">
                  <StepNumber n={1} />
                  <div>
                    <strong>Crea tu cuenta en Kova</strong> — Registrate en{' '}
                    <a href="https://app.heykova.io/register" target="_blank" rel="noopener noreferrer">app.heykova.io</a>.
                    El plan Free es gratuito y no requiere tarjeta de credito.
                  </div>
                </div>
                <div className="docs-step">
                  <StepNumber n={2} />
                  <div>
                    <strong>Selecciona Shopify como plataforma</strong> — En el primer paso del onboarding, elige Shopify.
                  </div>
                </div>
                <div className="docs-step">
                  <StepNumber n={3} />
                  <div>
                    <strong>Ingresa tu dominio Shopify</strong> — Escribe el dominio de tu tienda
                    (ej: <code>mitienda.myshopify.com</code>). No uses tu dominio personalizado, usa el dominio .myshopify.com.
                  </div>
                </div>
                <div className="docs-step">
                  <StepNumber n={4} />
                  <div>
                    <strong>Autoriza la app</strong> — Seras redirigido a Shopify para revisar y aceptar los permisos.
                    Kova solicita acceso a:
                    <ul style={{ marginTop: '0.5rem' }}>
                      <li>Lectura de productos, variantes y colecciones</li>
                      <li>Lectura de pedidos (para atribucion de conversiones)</li>
                      <li>Escritura de script tags (para inyectar el widget)</li>
                    </ul>
                  </div>
                </div>
                <div className="docs-step">
                  <StepNumber n={5} />
                  <div>
                    <strong>Completa el onboarding</strong> — Despues de autorizar, regresaras al panel de Kova para
                    completar la informacion de tu tienda, elegir un plan, y configurar el widget.
                  </div>
                </div>
                <div className="docs-step">
                  <StepNumber n={6} />
                  <div>
                    <strong>Sincronizacion automatica</strong> — Kova sincroniza automaticamente tu catalogo completo.
                    Recibiras una notificacion cuando el proceso termine. Los webhooks quedan registrados
                    para futuras actualizaciones automaticas.
                  </div>
                </div>
              </div>
            </div>

            <div id="shopify-configuracion" className="docs-subsection">
              <h3>Activar el widget en tu tema</h3>
              <div className="docs-steps">
                <div className="docs-step">
                  <StepNumber n={1} />
                  <div>
                    Ve a <strong>Shopify Admin &gt; Online Store &gt; Themes &gt; Customize</strong>.
                  </div>
                </div>
                <div className="docs-step">
                  <StepNumber n={2} />
                  <div>
                    En el editor del tema, busca la seccion <strong>App Embeds</strong> (o &quot;Bloques de app&quot;
                    en espanol) en la barra lateral izquierda. Activa <strong>Kova AI Chat Widget</strong>.
                  </div>
                </div>
                <div className="docs-step">
                  <StepNumber n={3} />
                  <div>
                    Desde el Theme Editor puedes ajustar configuraciones basicas como colores y posicion del widget.
                    Estos valores actuan como <strong>valores por defecto</strong>.
                  </div>
                </div>
                <div className="docs-step">
                  <StepNumber n={4} />
                  <div>
                    Haz clic en <strong>Guardar</strong> en el Theme Editor para publicar los cambios.
                  </div>
                </div>
              </div>

              <TipBox>
                <strong>Prioridad de configuracion:</strong> Los ajustes del Theme Editor de Shopify son valores por defecto.
                La configuracion que hagas desde el panel de Kova (colores, mensajes, funciones) tiene prioridad
                y sobreescribe los valores del tema en tiempo real. Esto te permite cambiar la configuracion sin
                necesidad de editar el tema.
              </TipBox>

              <div className="docs-callout docs-callout-success">
                <strong>Listo!</strong> El asistente IA esta activo en tu tienda Shopify. Los webhooks
                (<code>products/create</code>, <code>products/update</code>, <code>products/delete</code>,{' '}
                <code>app/uninstalled</code>) mantienen todo sincronizado automaticamente.
              </div>

              <h3>Panel embebido en Shopify Admin</h3>
              <p>
                Si instalaste Kova desde la Shopify App Store, tambien podras acceder al panel de Kova directamente
                desde tu Shopify Admin, sin necesidad de ir a un sitio externo. El panel embebido usa App Bridge 3.0
                y te permite gestionar el widget, la IA y las analiticas sin salir de Shopify.
              </p>

              <h3>Solucion de problemas</h3>
              <ul>
                <li><strong>El widget no aparece</strong> — Verifica que el App Block esta activado en Theme Editor &gt; App Embeds. Si usas un tema clasico (no Online Store 2.0), puede que necesites agregar el snippet manualmente.</li>
                <li><strong>Error de autorizacion</strong> — Intenta desinstalar y reinstalar la app desde Shopify Admin &gt; Settings &gt; Apps.</li>
                <li><strong>Productos desactualizados</strong> — Fuerza una sincronizacion desde el panel de Kova. Tambien verifica que los webhooks esten activos en Shopify Admin &gt; Settings &gt; Notifications &gt; Webhooks.</li>
              </ul>
            </div>
          </section>

          {/* ════════════════ Panel de Control ════════════════ */}
          <section id="panel" className="docs-section">
            <h2>Panel de Control</h2>
            <p>
              El panel de Kova es tu centro de operaciones. Desde aqui gestionas la configuracion del widget,
              el comportamiento de la IA, la base de conocimiento, las analiticas de conversion y tu suscripcion.
              Accedes desde <a href="https://app.heykova.io" target="_blank" rel="noopener noreferrer">app.heykova.io</a> con
              tu email y contrasena, o directamente desde Shopify Admin si usas la integracion embebida.
            </p>

            <h3>Dashboard principal</h3>
            <p>
              Al iniciar sesion veras un resumen completo del estado de tu tienda con las siguientes secciones:
            </p>
            <ul>
              <li><strong>Tiendas activas</strong> — Numero de tiendas conectadas a tu cuenta y su estado de conexion</li>
              <li><strong>Productos sincronizados</strong> — Total de productos indexados con embeddings semanticos, con barra de progreso respecto al limite de tu plan</li>
              <li><strong>Plan actual</strong> — Tu plan de suscripcion vigente (Free, Starter, Professional o Enterprise) con acceso rapido a cambiar de plan</li>
              <li><strong>Mensajes este mes</strong> — Barra de progreso mostrando la cantidad de respuestas IA generadas vs. tu limite mensual. Solo se cuentan las respuestas del agente, no los mensajes de los clientes</li>
              <li><strong>Llamadas este mes</strong> — Si tu plan incluye agente de voz, muestra el uso de llamadas del periodo actual</li>
            </ul>

            <h3>Checklist de configuracion</h3>
            <p>
              Si aun no has completado el setup inicial, el dashboard muestra una barra de progreso
              con los pasos pendientes:
            </p>
            <ol>
              <li><strong>Crear cuenta</strong> — Registro completado</li>
              <li><strong>Conectar tienda</strong> — Plugin instalado (WooCommerce) o app autorizada (Shopify)</li>
              <li><strong>Personalizar widget</strong> — Colores, mensajes y funciones configuradas</li>
              <li><strong>Primera conversacion</strong> — Al menos un cliente ha interactuado con el chat</li>
            </ol>
            <p>
              La barra se completa al 100% cuando los 4 pasos estan hechos. Cada paso tiene un enlace directo
              a la seccion correspondiente para completarlo.
            </p>

            <h3>Estado del servicio</h3>
            <p>
              El panel incluye indicadores en tiempo real del estado de los servicios principales:
            </p>
            <ul>
              <li><strong>Widget Chat</strong> — Si el widget esta activo y accesible en tu tienda</li>
              <li><strong>Servicio de IA</strong> — Estado de la conexion con OpenAI</li>
              <li><strong>Sincronizacion</strong> — Si los webhooks estan funcionando correctamente</li>
            </ul>

            <h3>Acciones rapidas</h3>
            <p>
              Desde el dashboard accedes directamente a las acciones mas comunes: configurar el widget,
              ver estadisticas de conversiones, gestionar la base de conocimiento o forzar una sincronizacion
              manual de productos (util cuando realizas cambios masivos en tu catalogo).
            </p>

            <h3>Navegacion del panel</h3>
            <p>
              El menu lateral del panel da acceso a todas las secciones:
            </p>
            <ul>
              <li><strong>Dashboard</strong> — Vista general y metricas</li>
              <li><strong>Mi Tienda</strong> — Datos de conexion, credenciales y sincronizacion</li>
              <li><strong>Widget</strong> — Configuracion visual y funcional del chat</li>
              <li><strong>Configuracion IA</strong> — Modelo, tono, instrucciones y modo de operacion</li>
              <li><strong>Base de Conocimiento</strong> — Documentos para enriquecer las respuestas</li>
              <li><strong>Analiticas</strong> — Metricas de conversion y rendimiento</li>
              <li><strong>Agente de Voz</strong> — Configuracion de llamadas por voz (planes Professional+)</li>
              <li><strong>Suscripcion</strong> — Plan actual, limites y facturacion</li>
            </ul>
          </section>

          {/* ════════════════ Widget ════════════════ */}
          <section id="widget" className="docs-section">
            <h2>Configuracion del Widget</h2>
            <p>
              El widget es la interfaz que tus clientes ven e interactuan en tu tienda. Es un componente
              JavaScript vanilla (~7,000 lineas) que se carga de forma asincrona y no afecta el rendimiento
              de tu pagina. La configuracion se divide en tres pestanas: Apariencia, Contenido y Funcionalidades.
            </p>

            <h3>Apariencia</h3>
            <p>Controla el aspecto visual del widget:</p>
            <ul>
              <li><strong>Tema</strong> — Modo claro u oscuro. El modo oscuro invierte los fondos y ajusta los contrastes del chat completo.</li>
              <li><strong>Color primario</strong> — Color principal del boton flotante, encabezado y acentos. Por defecto: <code>#6d5cff</code> (violeta). Acepta cualquier color hexadecimal.</li>
              <li><strong>Color secundario</strong> — Color de textos y elementos secundarios. Por defecto: <code>#212120</code> (casi negro).</li>
              <li><strong>Color de acento</strong> — Para botones de accion, links y destacados dentro del chat. Por defecto: <code>#8b7afc</code> (violeta claro).</li>
              <li><strong>Posicion del widget</strong> — Cuatro opciones: abajo-derecha (por defecto), abajo-izquierda, arriba-derecha o arriba-izquierda. Determina donde aparece el boton flotante y hacia donde se abre la ventana de chat.</li>
              <li><strong>Estilo del boton</strong> — Tres opciones: circular (por defecto), redondeado (esquinas suaves) o cuadrado.</li>
              <li><strong>Tamano del boton</strong> — Deslizador de 56px a 80px. Por defecto: 72px. Afecta solo al boton flotante, no al tamano del chat.</li>
              <li><strong>Ancho del chat</strong> — Deslizador de 320px a 500px. Por defecto: 420px. En movil se adapta automaticamente al ancho de la pantalla.</li>
              <li><strong>Alto del chat</strong> — Deslizador de 400px a 700px. Por defecto: 600px. En movil se adapta a la altura disponible.</li>
            </ul>

            <h3>Contenido</h3>
            <p>Personaliza los textos que ven tus clientes:</p>
            <ul>
              <li><strong>Nombre de marca</strong> — Texto en el encabezado del widget. Por defecto: &quot;Kova&quot;. Usa el nombre de tu tienda o marca.</li>
              <li><strong>Avatar / Emoji</strong> — Emoji o texto corto (maximo 4 caracteres) que aparece como avatar del asistente en cada mensaje. Ejemplos: &quot;🛍️&quot;, &quot;AI&quot;, &quot;👋&quot;.</li>
              <li><strong>Mensaje de bienvenida</strong> — Texto del tooltip/mensaje promocional que aparece junto al boton flotante para invitar a los clientes a abrir el chat. Ejemplo: &quot;Hola! Puedo ayudarte a encontrar lo que buscas&quot;.</li>
              <li><strong>Subtitulo</strong> — Texto secundario debajo del nombre de marca en el header del chat. Ejemplo: &quot;Asistente de compras&quot;, &quot;Normalmente responde al instante&quot;.</li>
              <li><strong>Placeholder del input</strong> — Texto de ejemplo que aparece en el campo de escritura cuando esta vacio. Ejemplo: &quot;Escribe tu pregunta...&quot;, &quot;Busca un producto...&quot;.</li>
            </ul>

            <h3>Funcionalidades</h3>
            <p>Activa o desactiva funciones del widget:</p>
            <ul>
              <li><strong>Animacion de pulso</strong> — Efecto visual pulsante en el boton flotante que atrae la atencion de los visitantes. Util para tiendas nuevas donde los clientes aun no conocen el chat.</li>
              <li><strong>Mensaje promocional</strong> — Muestra/oculta el tooltip de bienvenida junto al boton flotante. Se muestra una vez por sesion del visitante.</li>
              <li><strong>Carrito integrado</strong> — Cuando esta activo, la IA puede mostrar botones de &quot;Agregar al carrito&quot; en las recomendaciones de productos. Los productos se agregan al carrito nativo de tu plataforma (WooCommerce o Shopify).</li>
              <li><strong>Contacto telefonico</strong> — Habilita un boton de llamada en el header del widget que conecta con el agente de voz via Retell AI. Requiere configurar el Agent ID y numero telefonico en la seccion Agente de Voz.</li>
              <li><strong>Animaciones</strong> — Transiciones y efectos visuales generales: apertura/cierre del chat, aparicion de mensajes, etc. Desactivar puede mejorar el rendimiento en dispositivos muy antiguos.</li>
            </ul>

            <TipBox>
              <strong>Vista previa en vivo:</strong> Mientras editas la configuracion, veras una previsualizacion
              interactiva del widget junto al formulario. Puedes hacer clic en el boton de preview para ver como
              se ve abierto. Los cambios no se publican en tu tienda hasta que presiones <strong>Guardar Cambios</strong>.
            </TipBox>

            <h3>Estado del widget</h3>
            <p>
              Puedes activar o desactivar el widget sin perder tu configuracion. Cuando esta inactivo,
              el script se carga pero no renderiza el boton flotante ni el chat. Esto es util para
              hacer mantenimiento o si quieres pausar el servicio temporalmente.
            </p>

            <h3>Anti-cache</h3>
            <p>
              El widget se sirve con headers anti-cache (<code>no-cache, max-age=0</code>) y un ETag basado en
              timestamp, lo que garantiza que tus clientes siempre reciban la version mas reciente sin necesidad
              de purgar caches manualmente.
            </p>
          </section>

          {/* ════════════════ IA ════════════════ */}
          <section id="ia" className="docs-section">
            <h2>Configuracion de IA</h2>
            <p>
              La configuracion de IA determina como se comporta el asistente en las conversaciones con tus clientes.
              Puedes elegir entre usar el motor de IA integrado de Kova o conectar tu propio servicio externo.
            </p>

            <h3>Modo de operacion</h3>
            <p>Kova ofrece dos modos de operacion:</p>
            <ul>
              <li>
                <strong>IA Interna (recomendado)</strong> — Kova usa su motor de IA integrado que combina:
                <ul>
                  <li>Busqueda semantica de productos con embeddings (pgvector)</li>
                  <li>Contexto de la base de conocimiento (RAG - Retrieval Augmented Generation)</li>
                  <li>Instrucciones personalizadas y descripcion de marca</li>
                  <li>Historial de la conversacion para respuestas coherentes</li>
                </ul>
                No necesitas API keys adicionales ni configurar nada externo.
              </li>
              <li>
                <strong>Endpoint Externo</strong> — Conecta tu propio servicio de chatbot. Los mensajes del cliente se
                reenvian directamente a tu URL. Tu endpoint debe aceptar peticiones <code>POST</code> con el cuerpo:{' '}
                <code>{`{ "message": "texto", "shop": "dominio", "session_id": "uuid" }`}</code>.
                Kova se encarga del widget, la interfaz y la persistencia; tu servicio maneja la logica de respuestas.
                Ideal para conectar con flujos de n8n, Dialogflow, o tu propia IA.
              </li>
            </ul>

            <h3>Personalizacion del agente (modo interno)</h3>
            <p>
              Estas opciones estan disponibles cuando usas el modo de IA interna:
            </p>
            <ul>
              <li><strong>Nombre del agente</strong> — Como se presenta el asistente al inicio de la conversacion. Ejemplo: &quot;Sofia&quot;, &quot;Asesor de Belleza&quot;, &quot;Equipo de Soporte&quot;. Usa un nombre que conecte con tu marca y audiencia.</li>
              <li>
                <strong>Descripcion de marca</strong> — Contexto detallado sobre tu negocio que la IA incluye en cada respuesta.
                Describe tu marca, sector, publico objetivo, valores y diferenciadores. Cuanto mas especifico seas, mejores seran
                las recomendaciones. Ejemplo: &quot;Somos una tienda de cosmetica natural enfocada en mujeres 25-45 anos.
                Nos diferenciamos por ingredientes organicos certificados y packaging eco-friendly.&quot;
              </li>
              <li>
                <strong>Tono de comunicacion</strong> — Define el estilo de las respuestas:
                <ul>
                  <li><em>Cercano y amigable</em> — Conversacional, usa emojis, tutea al cliente. Ideal para moda, belleza, lifestyle.</li>
                  <li><em>Formal y profesional</em> — Lenguaje corporativo, sin emojis, trata de &quot;usted&quot;. Para B2B, tecnologia, servicios profesionales.</li>
                  <li><em>Casual</em> — Relajado y directo, como hablar con un amigo. Para marcas jovenes, streetwear, deportes.</li>
                  <li><em>Profesional</em> — Equilibrio entre formal y cercano. Opcion por defecto, funciona para la mayoria de tiendas.</li>
                </ul>
              </li>
              <li>
                <strong>Idioma</strong> — Idioma principal de las respuestas del agente:
                <ul>
                  <li>Espanol (por defecto)</li>
                  <li>English</li>
                  <li>Portugues</li>
                </ul>
                La IA puede entender mensajes en otros idiomas, pero respondera siempre en el idioma configurado.
              </li>
              <li>
                <strong>Instrucciones adicionales</strong> — Campo de texto libre donde defines reglas especificas para el agente.
                Ejemplos de instrucciones utiles:
                <ul>
                  <li>&quot;Nunca recomiendes productos de la competencia&quot;</li>
                  <li>&quot;Si preguntan por envio internacional, indica que solo enviamos a Espana y Mexico&quot;</li>
                  <li>&quot;Siempre sugiere productos complementarios despues de una recomendacion&quot;</li>
                  <li>&quot;Si el cliente pide un producto agotado, sugiere alternativas similares&quot;</li>
                  <li>&quot;No menciones precios en dolares, solo en euros&quot;</li>
                </ul>
              </li>
              <li>
                <strong>Modelo de IA</strong> — Selecciona el modelo de OpenAI que procesa las respuestas:
                <ul>
                  <li><em>GPT-4.1 Mini</em> (recomendado) — Mejor equilibrio entre velocidad, calidad y costo. Respuestas en ~1-2 segundos.</li>
                  <li><em>GPT-4o</em> — Modelo multimodal avanzado. Excelente comprension contextual. Ligeramente mas lento.</li>
                  <li><em>GPT-4</em> — Mayor precision en razonamiento complejo. El mas lento pero mas preciso para consultas dificiles.</li>
                  <li><em>GPT-3.5 Turbo</em> — El mas rapido y economico. Adecuado si priorizas velocidad sobre calidad en las respuestas.</li>
                </ul>
              </li>
            </ul>

            <TipBox>
              <strong>Mejores resultados:</strong> Los tres campos que mas impactan en la calidad de respuestas son:
              descripcion de marca, instrucciones adicionales y la base de conocimiento.
              Cuanto mas contexto le des a la IA sobre tu negocio, mas relevantes y precisas seran las recomendaciones para tus clientes.
            </TipBox>

            <WarningBox>
              El modelo de IA afecta la velocidad de respuesta y el consumo de mensajes de tu plan.
              Todos los modelos consumen 1 mensaje por respuesta, pero los modelos mas avanzados (GPT-4, GPT-4o) pueden ser
              ligeramente mas lentos. Recomendamos empezar con GPT-4.1 Mini.
            </WarningBox>
          </section>

          {/* ════════════════ Knowledge Base ════════════════ */}
          <section id="knowledge" className="docs-section">
            <h2>Base de Conocimiento</h2>
            <p>
              La base de conocimiento permite enriquecer las respuestas de la IA con informacion especifica
              de tu negocio que no esta en el catalogo de productos. Usa RAG (Retrieval Augmented Generation)
              para buscar los fragmentos mas relevantes de tus documentos y incluirlos como contexto en cada respuesta.
            </p>

            <h3>Para que sirve</h3>
            <p>
              Ejemplos de contenido ideal para la base de conocimiento:
            </p>
            <ul>
              <li><strong>Politicas de envio y devoluciones</strong> — Plazos, costos, condiciones, paises disponibles</li>
              <li><strong>Guias de tallas</strong> — Tablas de tallas, como medirse, equivalencias entre paises</li>
              <li><strong>FAQ del negocio</strong> — Preguntas frecuentes que reciben tus agentes de soporte</li>
              <li><strong>Informacion de marca</strong> — Historia, valores, proceso de fabricacion, certificaciones</li>
              <li><strong>Instrucciones de uso/cuidado</strong> — Como usar los productos, mantenimiento, garantia</li>
              <li><strong>Promociones y descuentos</strong> — Cupones activos, condiciones de promociones vigentes</li>
            </ul>

            <h3>Formatos y limites</h3>
            <ul>
              <li><strong>PDF</strong> — Hasta 10MB por archivo. Se extrae el texto automaticamente.</li>
              <li><strong>Texto plano</strong> (.txt) — Sin limite de formato, ideal para contenido ya estructurado.</li>
              <li><strong>Markdown</strong> (.md) — Soporta formato Markdown. Util si ya tienes documentacion en este formato.</li>
            </ul>
            <p>
              La cantidad de documentos que puedes subir depende de tu plan:
            </p>
            <ul>
              <li><strong>Free</strong> — No incluye base de conocimiento</li>
              <li><strong>Starter</strong> — 1 documento</li>
              <li><strong>Professional</strong> — 10 documentos</li>
              <li><strong>Enterprise</strong> — Ilimitados</li>
            </ul>

            <h3>Metodos de carga</h3>
            <p>Puedes agregar contenido de dos formas:</p>
            <ul>
              <li>
                <strong>Texto directo</strong> — Pega el contenido directamente en el editor con un titulo descriptivo.
                Ideal para politicas, FAQ o informacion que ya tienes en texto. No requiere archivo.
              </li>
              <li>
                <strong>Subir archivo</strong> — Arrastra o selecciona un archivo PDF, TXT o MD.
                El titulo es opcional; si no lo especificas, se usa el nombre del archivo.
              </li>
            </ul>

            <h3>Procesamiento interno</h3>
            <p>
              Cuando subes un documento, Kova realiza el siguiente proceso automaticamente:
            </p>
            <ol>
              <li><strong>Extraccion de texto</strong> — Se extrae el contenido textual del archivo (en el caso de PDFs, se convierte a texto plano)</li>
              <li><strong>Fragmentacion (chunking)</strong> — El texto se divide en fragmentos de ~500 tokens con un solapamiento de 50 tokens entre fragmentos consecutivos. El solapamiento garantiza que no se pierda contexto en los limites entre fragmentos.</li>
              <li><strong>Generacion de embeddings</strong> — Cada fragmento se convierte en un vector numerico usando la API de OpenAI. Estos vectores capturan el significado semantico del texto.</li>
              <li><strong>Almacenamiento</strong> — Los fragmentos y sus embeddings se guardan en la base de datos con pgvector para busqueda eficiente por similitud.</li>
              <li><strong>Disponibilidad</strong> — Una vez procesado, cuando un cliente hace una pregunta, se buscan los fragmentos mas similares semanticamente y se incluyen como contexto para la IA.</li>
            </ol>

            <h3>Estados de procesamiento</h3>
            <ul>
              <li><strong>Pendiente</strong> — El documento esta en cola esperando ser procesado</li>
              <li><strong>Procesando</strong> — Se esta analizando, fragmentando y generando embeddings</li>
              <li><strong>Listo</strong> — Activo y disponible para las conversaciones. El panel muestra la cantidad de fragmentos generados (ej: &quot;23 fragmentos&quot;).</li>
              <li><strong>Error</strong> — Hubo un problema al procesar. El mensaje de error te indica la causa (archivo corrupto, formato no soportado, etc.)</li>
            </ul>

            <TipBox>
              <strong>Mejores practicas:</strong> Usa documentos concisos y bien estructurados. Un documento de 2 paginas
              con informacion clara funciona mejor que uno de 50 paginas con mucho contenido irrelevante. La IA selecciona
              los fragmentos mas relevantes para cada pregunta, pero si hay mucho &quot;ruido&quot;, la calidad de las
              respuestas puede disminuir.
            </TipBox>

            <WarningBox>
              Los documentos no se actualizan automaticamente. Si cambias tus politicas de envio, necesitas
              eliminar el documento anterior y subir la version actualizada. El cache de la base de conocimiento
              se actualiza cada 5 minutos.
            </WarningBox>
          </section>

          {/* ════════════════ Analytics ════════════════ */}
          <section id="analytics" className="docs-section">
            <h2>Analiticas y Conversiones</h2>
            <p>
              El panel de analiticas te permite medir el impacto real del asistente de IA en tus ventas.
              Kova rastrea cada producto recomendado en el chat y lo cruza con los pedidos completados
              para calcular la atribucion de ventas. Las analiticas avanzadas estan disponibles en los
              planes Professional y Enterprise.
            </p>

            <h3>Metricas principales</h3>
            <p>El dashboard de analiticas muestra cuatro tarjetas principales:</p>
            <ul>
              <li><strong>Recomendaciones</strong> — Total de productos sugeridos por la IA durante las conversaciones. Cada vez que la IA muestra un producto como recomendacion, se cuenta aqui.</li>
              <li><strong>Conversiones</strong> — Numero de compras atribuidas al chat. Una conversion ocurre cuando un cliente que recibio una recomendacion en el chat compra ese producto (o cualquier producto) dentro de la ventana de atribucion.</li>
              <li><strong>Ingresos atribuidos</strong> — Valor monetario total de las ventas generadas desde recomendaciones del chat. Se muestra en la moneda de tu tienda.</li>
              <li><strong>Tasa de conversion</strong> — Porcentaje de recomendaciones que resultan en una compra. Formula: (conversiones / recomendaciones) x 100.</li>
            </ul>

            <h3>Metricas secundarias</h3>
            <ul>
              <li><strong>Ticket promedio</strong> — Valor promedio por orden de compra atribuida al chat. Te ayuda a entender si las recomendaciones de la IA generan compras de mayor o menor valor que el promedio de tu tienda.</li>
              <li><strong>Tiempo promedio a conversion</strong> — Cuanto tiempo tarda un cliente desde que recibe una recomendacion hasta que completa la compra. Util para entender el ciclo de decision de tus clientes.</li>
            </ul>

            <h3>Tipos de atribucion</h3>
            <p>
              Las conversiones se clasifican segun la ventana de tiempo entre la recomendacion y la compra.
              Esto permite distinguir el impacto directo del chat del impacto indirecto:
            </p>
            <ul>
              <li><strong>Directa (0 - 30 minutos)</strong> — El cliente compro poco despues de recibir la recomendacion. Indica una influencia directa y clara del chat en la decision de compra.</li>
              <li><strong>Asistida (30 min - 24 horas)</strong> — El cliente interactuo con el chat, se fue, y volvio a comprar dentro de las 24 horas. El chat ayudo en la decision pero no fue el unico factor.</li>
              <li><strong>View-Through (24h - 7 dias)</strong> — El cliente vio productos en el chat y compro dentro de la semana. Captura el impacto a largo plazo de las recomendaciones.</li>
            </ul>

            <h3>Visualizaciones</h3>
            <ul>
              <li><strong>Grafico de barras diario</strong> — Muestra recomendaciones vs. conversiones dia a dia durante el periodo seleccionado. Permite identificar tendencias y dias con mayor actividad.</li>
              <li><strong>Comparacion de periodos</strong> — Compara las metricas del periodo actual con el periodo anterior (ej: ultimos 30 dias vs. los 30 dias previos). Muestra el cambio porcentual en conversiones, ingresos y tasa de conversion.</li>
              <li><strong>Productos con mayor conversion</strong> — Ranking de los productos que mas ventas generan desde el chat. Incluye nombre del producto, numero de conversiones e ingresos generados.</li>
              <li><strong>Actividad reciente</strong> — Timeline cronologico de las ultimas recomendaciones y conversiones, con detalles de cada interaccion.</li>
            </ul>

            <h3>Filtro de periodos</h3>
            <p>
              Todas las metricas se pueden filtrar por periodos predefinidos: <strong>7 dias</strong>,{' '}
              <strong>14 dias</strong>, <strong>30 dias</strong> o <strong>90 dias</strong>. Al cambiar el periodo,
              todas las tarjetas, graficos y tablas se actualizan automaticamente.
            </p>

            <TipBox>
              <strong>Interpretacion:</strong> Una tasa de conversion del 2-5% es normal para recomendaciones de producto.
              Si tu tasa es menor al 1%, revisa la calidad de tus descripciones de productos y la configuracion
              del agente (tono, instrucciones, modelo IA). Si es mayor al 10%, tu IA esta generando recomendaciones
              muy precisas.
            </TipBox>
          </section>

          {/* ════════════════ Voice ════════════════ */}
          <section id="voice" className="docs-section">
            <h2>Agente de Voz</h2>
            <p>
              El agente de voz permite a tus clientes hablar con un asistente IA por telefono,
              complementando la experiencia del chat de texto. Utiliza la tecnologia de Retell AI
              para ofrecer conversaciones naturales con voces sinteticas de alta calidad.
            </p>

            <WarningBox>
              El agente de voz esta disponible exclusivamente en los planes <strong>Professional</strong> y{' '}
              <strong>Enterprise</strong>. Si estas en plan Free o Starter, necesitas actualizar tu plan
              para acceder a esta funcionalidad.
            </WarningBox>

            <h3>Como funciona</h3>
            <p>
              El agente de voz recibe llamadas telefonicas y las procesa con IA en tiempo real.
              El flujo es: el cliente llama al numero asignado → Retell AI transcribe la voz a texto →
              la IA genera una respuesta → Retell AI convierte la respuesta a voz y la reproduce al cliente.
              Todo esto sucede en milisegundos, creando una conversacion fluida y natural.
            </p>

            <h3>Configuracion basica</h3>
            <ul>
              <li>
                <strong>Voz</strong> — Selecciona entre las voces disponibles en Retell AI. El panel incluye un reproductor
                para previsualizar el audio de cada voz antes de elegir. Las voces varian en genero, acento y personalidad.
              </li>
              <li>
                <strong>Idioma</strong> — 9 opciones disponibles:
                <ul>
                  <li>English (US) y English (UK)</li>
                  <li>Spanish (Spain) y Spanish (Mexico)</li>
                  <li>French, German, Italian</li>
                  <li>Portuguese (Brazil)</li>
                  <li>Multilingue — detecta automaticamente el idioma del hablante</li>
                </ul>
              </li>
              <li><strong>Velocidad de voz</strong> — Ajusta la velocidad con la que habla el agente. Valores mas bajos = mas lento y pausado; mas altos = mas rapido.</li>
              <li><strong>Temperatura de voz</strong> — Controla la variabilidad en la entonacion. Temperaturas bajas son mas monotonales; altas son mas expresivas.</li>
              <li><strong>Responsividad</strong> — Que tan rapido responde el agente despues de que el cliente termina de hablar. Valores bajos = respuestas mas rapidas pero puede interrumpir; altos = espera mas antes de responder.</li>
              <li><strong>Sensibilidad a interrupciones</strong> — Define que tan facilmente el cliente puede interrumpir al agente mientras habla. Util para conversaciones dinamicas.</li>
              <li><strong>Backchannel</strong> — Habilita respuestas cortas automaticas (&quot;ajam&quot;, &quot;claro&quot;, &quot;entiendo&quot;) durante pausas del cliente, simulando una conversacion mas humana y natural.</li>
            </ul>

            <h3>Configuracion avanzada</h3>
            <ul>
              <li>
                <strong>Modelo IA para voz</strong> — Diferente del modelo de chat, puedes elegir:
                <ul>
                  <li>GPT-4.1 — Maxima calidad de respuesta</li>
                  <li>GPT-4.1 Mini — Buen equilibrio velocidad/calidad (recomendado)</li>
                  <li>Claude 4.5 Sonnet — Modelo de Anthropic, excelente en conversaciones naturales</li>
                  <li>Gemini 2.5 Flash — Modelo de Google, muy rapido</li>
                </ul>
              </li>
              <li>
                <strong>Sonido ambiente</strong> — Agrega un fondo sonoro sutil para una experiencia mas inmersiva:
                Coffee Shop, Convention Hall, Summer Outdoor, Mountain Outdoor, Static Noise o Call Center.
              </li>
              <li><strong>Duracion maxima de llamada</strong> — Limite de tiempo por llamada. Por defecto: 30 minutos. Puedes reducirlo para controlar costos.</li>
              <li><strong>Silencio para colgar</strong> — Segundos de silencio antes de finalizar la llamada automaticamente. Por defecto: 30 segundos. Evita que las llamadas queden abiertas si el cliente cuelga sin despedirse.</li>
              <li><strong>Palabras clave reforzadas (boosted keywords)</strong> — Terminos especificos de tu negocio que el reconocimiento de voz debe priorizar. Util para nombres de productos, marcas o terminos tecnicos que el speech-to-text podria no reconocer bien.</li>
              <li><strong>Prompt personalizado</strong> — Instrucciones especificas para el modo de voz. Puede diferir del prompt del chat porque la conversacion por voz tiene un ritmo diferente.</li>
              <li><strong>Mensaje inicial</strong> — Lo primero que dice el agente al contestar la llamada. Ejemplo: &quot;Hola, gracias por llamar a [tu marca]. Soy Sofia, en que puedo ayudarte hoy?&quot;</li>
            </ul>

            <h3>Funciones de gestion</h3>
            <ul>
              <li><strong>Llamada de prueba</strong> — Realiza una llamada de prueba desde el panel a cualquier numero de telefono para verificar que la configuracion funciona correctamente antes de publicar.</li>
              <li><strong>Historial de llamadas</strong> — Log completo de todas las llamadas recibidas, con: duracion, estado (completada, fallida, sin respuesta), transcripcion completa del dialogo y grabacion de audio reproducible.</li>
              <li><strong>Metricas de uso</strong> — Total de llamadas del mes con barra de progreso segun el limite de tu plan.</li>
            </ul>

            <TipBox>
              <strong>Consejo:</strong> Empieza con el modelo GPT-4.1 Mini y la configuracion por defecto.
              Haz una llamada de prueba y ajusta la velocidad, responsividad y tono segun la experiencia.
              Agrega palabras clave reforzadas con los nombres de tus productos mas populares.
            </TipBox>
          </section>

          {/* ════════════════ Planes ════════════════ */}
          <section id="planes" className="docs-section">
            <h2>Planes y Facturacion</h2>
            <p>
              Kova ofrece cuatro planes diseñados para diferentes tamaños de negocio.
              Todos los planes incluyen el widget de chat, busqueda semantica e integracion con WooCommerce y Shopify.
              Las diferencias estan en los limites de uso y funcionalidades avanzadas.
            </p>

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
                    <td>Precio</td>
                    <td>$0/mes</td>
                    <td>Consultar</td>
                    <td>Consultar</td>
                    <td>Consultar</td>
                  </tr>
                  <tr>
                    <td>Productos</td>
                    <td>50</td>
                    <td>500</td>
                    <td>5,000</td>
                    <td>Ilimitados</td>
                  </tr>
                  <tr>
                    <td>Mensajes IA/mes</td>
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
                    <td>---</td>
                    <td>1 documento</td>
                    <td>10 documentos</td>
                    <td>Ilimitados</td>
                  </tr>
                  <tr>
                    <td>Agente de voz</td>
                    <td>---</td>
                    <td>---</td>
                    <td>Incluido</td>
                    <td>Incluido</td>
                  </tr>
                  <tr>
                    <td>Branding personalizado</td>
                    <td>---</td>
                    <td>---</td>
                    <td>Incluido</td>
                    <td>Incluido</td>
                  </tr>
                  <tr>
                    <td>Acceso API</td>
                    <td>---</td>
                    <td>---</td>
                    <td>---</td>
                    <td>Incluido</td>
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

            <h3>Como se cuentan los mensajes</h3>
            <p>
              Los mensajes se contabilizan de la siguiente forma:
            </p>
            <ul>
              <li><strong>Solo se cuentan las respuestas de la IA</strong>, no los mensajes que envian tus clientes. Esto refleja el costo real de uso (tokens de OpenAI consumidos).</li>
              <li>El contador se reinicia al inicio de cada periodo de facturacion (mensual).</li>
              <li>Puedes ver el uso actual en el dashboard (barra de progreso &quot;Mensajes este mes&quot;) y en la seccion Suscripcion.</li>
              <li>Cuando alcanzas el limite, el asistente deja de responder hasta el siguiente periodo. Tus clientes veran un mensaje generico indicando que el servicio no esta disponible temporalmente.</li>
            </ul>

            <h3>Gestion de suscripcion</h3>
            <p>
              La facturacion se gestiona a traves de Stripe. Desde la seccion <strong>Suscripcion</strong> del panel puedes:
            </p>
            <ul>
              <li><strong>Ver tu plan actual</strong> — Nombre del plan con indicador de estado: Activo (verde), Trial (amarillo) o Cancelando (rojo, activo hasta fin de periodo).</li>
              <li><strong>Cambiar de plan</strong> — Los planes se muestran lado a lado con sus caracteristicas para comparar facilmente. El cambio es inmediato: al hacer upgrade se aplica al instante; al hacer downgrade se aplica al final del periodo actual.</li>
              <li><strong>Gestionar facturacion</strong> — Abre el portal de Stripe donde puedes actualizar tu tarjeta de credito, ver el historial de pagos y descargar facturas.</li>
              <li><strong>Cancelar suscripcion</strong> — El servicio se mantiene activo hasta el final del periodo ya pagado. No hay cargos adicionales.</li>
              <li><strong>Reactivar</strong> — Si cancelaste pero aun no ha terminado el periodo, puedes reactivar la suscripcion sin perder el acceso.</li>
            </ul>

            <TipBox>
              <strong>Recomendacion:</strong> Empieza con el plan Free para probar la plataforma. Cuando necesites mas
              productos o mensajes, actualiza a Starter o Professional. Puedes cambiar de plan en cualquier momento
              sin perder tu configuracion, documentos ni historial de conversaciones.
            </TipBox>

            <WarningBox>
              Si alcanzas el limite de productos de tu plan, no podras sincronizar nuevos productos hasta que actualices.
              Los productos ya sincronizados siguen funcionando con normalidad.
            </WarningBox>
          </section>

          {/* ════════════════ FAQ ════════════════ */}
          <section id="faq" className="docs-section">
            <h2>Preguntas Frecuentes</h2>

            <div className="docs-faq-item">
              <h3>Necesito conocimientos tecnicos para instalar Kova?</h3>
              <p>
                No. El proceso esta disenado para ser completamente accesible. En WooCommerce, solo necesitas
                subir un plugin ZIP (como cualquier otro plugin de WordPress) y las claves API se generan
                automaticamente. En Shopify, autorizas la app con un clic y activas el widget desde el Theme Editor.
                Todo el onboarding tiene un asistente paso a paso que te guia.
              </p>
            </div>

            <div className="docs-faq-item">
              <h3>Cuanto tarda la sincronizacion de productos?</h3>
              <p>
                Depende del tamano de tu catalogo. Como referencia: ~1 minuto para 100 productos,
                ~3 minutos para 500, ~5 minutos para 1,000. El proceso incluye la descarga de datos del producto
                (titulo, descripcion, imagenes, precios, variantes) y la generacion de embeddings semanticos
                para cada uno. Despues de la sincronizacion inicial, las actualizaciones se procesan en tiempo real
                via webhooks.
              </p>
            </div>

            <div className="docs-faq-item">
              <h3>Puedo personalizar completamente las respuestas del asistente?</h3>
              <p>
                Si, en gran medida. Puedes configurar: el nombre del agente, el tono de comunicacion (amigable,
                formal, casual o profesional), el idioma (espanol, ingles, portugues), instrucciones especificas
                (reglas de negocio, restricciones, formato de respuestas), una descripcion detallada de tu marca,
                y elegir entre 4 modelos de IA. Ademas, la base de conocimiento te permite subir documentos con
                informacion adicional que la IA usara en sus respuestas. El resultado es un asistente que suena
                y se comporta como parte de tu equipo.
              </p>
            </div>

            <div className="docs-faq-item">
              <h3>El widget afecta la velocidad de carga de mi tienda?</h3>
              <p>
                No de forma perceptible. El widget se carga de forma asincrona (no bloquea el renderizado de tu pagina)
                y es un unico archivo JavaScript. Se sirve con headers anti-cache para garantizar que siempre se use
                la version mas reciente. El impacto en el tiempo de carga es minimo (tipicamente &lt;100ms).
              </p>
            </div>

            <div className="docs-faq-item">
              <h3>Puedo conectar mi propio chatbot o IA personalizada?</h3>
              <p>
                Si. En la Configuracion de IA puedes seleccionar el modo &quot;Endpoint Externo&quot; e ingresar la URL
                de tu propio servicio. Kova se encarga del widget, la interfaz de chat y la persistencia de mensajes;
                tu servicio maneja la logica de respuestas. Tu endpoint recibe peticiones POST
                con <code>{`{ message, shop, session_id }`}</code> y debe devolver el texto de respuesta.
                Compatible con n8n, Dialogflow, APIs custom, o cualquier servicio que acepte HTTP POST.
              </p>
            </div>

            <div className="docs-faq-item">
              <h3>Los clientes pueden enviar audio e imagenes?</h3>
              <p>
                Si. El chat soporta entrada multimodal. Los mensajes de voz se transcriben automaticamente
                con Whisper de OpenAI (formatos: WebM, MP4, OGG, WAV — hasta 5MB). Las imagenes se pueden
                enviar en JPEG, PNG, WebP o GIF (hasta 2MB). Ambos se almacenan de forma segura en Supabase Storage.
              </p>
            </div>

            <div className="docs-faq-item">
              <h3>Puedo usar Kova en mas de una tienda?</h3>
              <p>
                Si. Cada tienda requiere su propia cuenta y plan. Puedes gestionar multiples tiendas creando
                cuentas separadas, cada una con su propia configuracion de widget, IA y base de conocimiento.
              </p>
            </div>

            <div className="docs-faq-item">
              <h3>Que pasa si alcanzo el limite de mensajes de mi plan?</h3>
              <p>
                El asistente dejara de responder hasta el siguiente periodo de facturacion (mensual).
                Tus clientes veran un mensaje generico indicando que el servicio no esta disponible temporalmente.
                Puedes actualizar tu plan en cualquier momento desde la seccion Suscripcion — el cambio es
                inmediato y el nuevo limite se aplica al instante.
                Recuerda que solo se cuentan las respuestas de la IA, no los mensajes de tus clientes.
              </p>
            </div>

            <div className="docs-faq-item">
              <h3>Como cancelo mi suscripcion?</h3>
              <p>
                Desde el panel de Kova, ve a <strong>Suscripcion</strong> y haz clic en <strong>Cancelar Suscripcion</strong>.
                El servicio continua activo hasta el final del periodo pagado (no se hacen cobros pro-rata).
                Puedes reactivar la suscripcion en cualquier momento antes de esa fecha.
                Tu configuracion, documentos y datos no se eliminan al cancelar.
              </p>
            </div>

            <div className="docs-faq-item">
              <h3>Que formatos de archivo soporta la base de conocimiento?</h3>
              <p>
                PDF (hasta 10MB), texto plano (.txt) y Markdown (.md). Los documentos se procesan automaticamente:
                se dividen en fragmentos de ~500 tokens con solapamiento de 50 tokens, y se generan embeddings
                semanticos para cada fragmento. Esto permite que la IA busque y use solo los fragmentos mas
                relevantes para cada pregunta del cliente.
              </p>
            </div>

            <div className="docs-faq-item">
              <h3>El agente de voz esta incluido en todos los planes?</h3>
              <p>
                No. El agente de voz esta disponible en los planes Professional y Enterprise.
                Utiliza tecnologia de Retell AI y soporta 9 idiomas con voces sinteticas de alta calidad.
                Incluye historial de llamadas con transcripcion, grabacion y metricas de uso.
              </p>
            </div>

            <div className="docs-faq-item">
              <h3>Como funciona la busqueda semantica?</h3>
              <p>
                Cuando un cliente escribe un mensaje, Kova convierte ese texto en un vector numerico (embedding)
                usando OpenAI. Luego busca en tu catalogo los productos cuyos embeddings son mas similares.
                Esto significa que el cliente no necesita usar las palabras exactas del titulo del producto:
                puede describir lo que busca (&quot;algo calido para el invierno&quot;) y Kova encontrara los
                productos relevantes (&quot;Abrigo de lana premium&quot;, &quot;Bufanda tejida&quot;, etc.).
              </p>
            </div>

            <div className="docs-faq-item">
              <h3>Mis datos estan seguros?</h3>
              <p>
                Si. Los datos se almacenan en Supabase con row-level security (RLS) para aislamiento multi-tenant.
                Las comunicaciones entre el plugin/widget y los servidores de Kova son siempre por HTTPS.
                Los webhooks de Shopify se validan con HMAC. No compartimos tus datos con terceros.
                Los archivos subidos (audio, imagenes) se almacenan en Supabase Storage con acceso restringido.
              </p>
            </div>

            <div className="docs-faq-item">
              <h3>Puedo usar Kova en un idioma diferente al espanol?</h3>
              <p>
                Si. El agente de chat soporta 3 idiomas configurables: espanol, ingles y portugues.
                La IA puede entender mensajes en otros idiomas, pero respondera en el idioma que configures.
                El agente de voz soporta 9 idiomas incluyendo frances, aleman e italiano, ademas de un modo
                multilingue que detecta el idioma automaticamente.
              </p>
            </div>
          </section>

          {/* Footer */}
          <footer className="docs-footer">
            <p>Necesitas ayuda? Contactanos en <a href="mailto:support@heykova.io">support@heykova.io</a></p>
          </footer>
        </main>
      </div>
    </div>
  );
}
