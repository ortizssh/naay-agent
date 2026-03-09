# Prompt Técnico + Contenido: Landing Page de Marketing para Kova

## Objetivo
Crear una landing page de marketing de alta conversión para **Kova** — un asistente de comercio conversacional con IA que se integra con Shopify y WooCommerce. La landing debe explicar al 100% cómo funciona el producto, transmitir confianza, y convertir visitantes en usuarios registrados. El diseño debe seguir exactamente la línea visual existente de la marca.

---

## 1. STACK TÉCNICO RECOMENDADO

### Framework & Build
- **Next.js 14+** (App Router) — SSR/SSG para SEO óptimo
- **TypeScript**
- **Tailwind CSS** — para replicar el sistema de diseño existente

### Librerías UI/UX
- **Framer Motion** — animaciones de scroll, entrada de secciones, hover states
- **Lucide React** — iconografía consistente (ya usado en el admin panel)
- **Embla Carousel** o **Swiper** — para carruseles de features/testimonios
- **React Intersection Observer** — para animaciones trigger-on-scroll

### Assets
- **Google Fonts**: Plus Jakarta Sans (weights: 400, 500, 600, 700)
- **Formato de video**: MP4 embebido o YouTube/Vimeo embed para demo

---

## 2. SISTEMA DE DISEÑO (copiar exacto de la app existente)

### Paleta de Colores

```css
/* Primary */
--kova-primary: #6b5afc;          /* Púrpura principal de marca */
--kova-primary-hover: #5849e0;    /* Púrpura oscuro para hover */
--kova-primary-light: #8b7dff;    /* Púrpura claro para acentos */
--kova-primary-shadow: rgba(109, 92, 255, 0.25); /* Sombra del botón principal */

/* Secondary & Accent */
--kova-accent: #cf795e;           /* Terracota — para CTAs secundarios */
--kova-dark: #212120;             /* Texto principal / fondos oscuros */
--kova-sage: #F8F9F8;             /* Fondo sutil / secciones alternadas */

/* Heritage (toques premium, usar con moderación) */
--kova-everyday: #cec8ae;
--kova-fresh: #90a284;
--kova-delicate: #c3ab79;

/* Semánticos */
--kova-success: #10b981;
--kova-warning: #f59e0b;
--kova-error: #ef4444;

/* Texto */
--text-primary: #1a1a2e;
--text-secondary: #64648c;
--text-muted: #9494b8;

/* UI */
--border: #e8e8f0;
--bg-main: #fafafa;
--bg-warm: #f5f3f0;
--bg-card: #ffffff;
```

### Tipografía
```css
font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Escala */
h1: 3.5rem (56px), font-weight: 700, line-height: 1.1
h2: 2.5rem (40px), font-weight: 700, line-height: 1.2
h3: 1.5rem (24px), font-weight: 600
body: 1rem (16px), font-weight: 400
small: 0.875rem (14px)
```

### Sombras y Efectos
```css
--shadow-sm: 0 2px 8px rgba(0,0,0,0.04);
--shadow-md: 0 8px 30px rgba(0,0,0,0.06);
--shadow-lg: 0 20px 60px rgba(0,0,0,0.08);
--shadow-primary: 0 8px 30px rgba(109, 92, 255, 0.25);
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 24px;
```

### Estilo Visual General
- Ultra-minimalista con toques de lujo
- Glassmorphism sutil en cards destacadas
- Fondo predominantemente blanco/sage con secciones alternadas
- Bordes sutiles (#e8e8f0), nunca bordes gruesos
- Espaciado generoso (padding 80-120px entre secciones)
- Animaciones suaves (ease-out, 300-500ms)

---

## 3. ESTRUCTURA DE SECCIONES

### Sección 1: Hero
**Layout**: Split — texto izquierda, widget demo visual derecha
**Contenido**:
- Tag superior: `Asistente de ventas con IA para e-commerce`
- **Headline**: "Convierte visitantes en compradores con IA conversacional"
- **Subheadline**: "Kova es un asistente de compras con inteligencia artificial que se integra en tu tienda Shopify o WooCommerce. Recomienda productos, gestiona el carrito y aumenta tus ventas — 24/7."
- **CTA Principal**: "Comenzar gratis" → registro (botón púrpura #6b5afc, sombra primary, bordes redondeados 12px)
- **CTA Secundario**: "Ver demo" → scroll a video (outline, borde púrpura)
- **Dato destacado debajo de CTAs**: "Trial de 14 días gratis · Sin tarjeta de crédito"
- **Visual derecho**: Mockup estático o animado del widget Kova en una tienda, mostrando una conversación real con recomendación de producto y botón de agregar al carrito.

**Logos de integración** (debajo del hero):
- Fila de logos: Shopify + WooCommerce
- Texto: "Se integra con las principales plataformas de e-commerce"

---

### Sección 2: Métricas Reales (Social Proof numérico)
**Layout**: 4 cards en fila horizontal sobre fondo --kova-sage

**Métricas (datos reales de producción)**:
| Métrica | Valor | Label |
|---------|-------|-------|
| Recomendaciones AI | 2,195+ | productos sugeridos |
| Conversaciones | 1,808+ | sesiones de chat |
| Tasa de conversión | 4.4% | de recomendación a compra |
| Tiempo promedio | <45 min | de recomendación a compra |

**Nota**: Estas son métricas reales del sistema en producción. Mostrar con un badge "Datos reales" o "Early access metrics" para transparencia.

---

### Sección 3: Cómo Funciona (3 pasos)
**Layout**: 3 columnas con iconos numerados + ilustraciones

**Paso 1 — Conecta tu tienda**
- Icono: Plug/Connection
- "Instala Kova en tu Shopify o WooCommerce en minutos. Sincronización automática de catálogo con embeddings semánticos."

**Paso 2 — Personaliza tu asistente**
- Icono: Palette/Brush
- "Configura colores, mensajes, tono de voz, idioma y comportamiento del AI. Se adapta a la identidad de tu marca."

**Paso 3 — Vende más con IA**
- Icono: TrendingUp/ShoppingCart
- "El asistente atiende a tus clientes 24/7: recomienda productos, gestiona el carrito y genera conversiones medibles."

---

### Sección 4: Video Demo
**Layout**: Video centrado con borde sutil y sombra-lg, aspect ratio 16:9
- Título: "Mira a Kova en acción"
- Subtítulo: "Descubre cómo el asistente interactúa con tus clientes en tiempo real"
- Video placeholder (reemplazar con video real): demostración del widget en una tienda mostrando:
  1. Apertura del widget con animación
  2. Conversación natural con recomendación de producto
  3. Producto mostrado con imagen, precio y botón de agregar al carrito
  4. Gestión del carrito integrada
  5. Checkout redirect
- Debajo: CTA "Pruébalo gratis" → registro

---

### Sección 5: Features Principales
**Layout**: Grid 2x3 con cards elevadas (shadow-md, hover: shadow-lg + translateY -4px)

**Feature 1 — Búsqueda Semántica con IA**
- Icono: Search/Brain
- "Entiende la intención del cliente, no solo keywords. Powered by embeddings vectoriales (pgvector + OpenAI) para encontrar el producto perfecto."

**Feature 2 — Gestión de Carrito Integrada**
- Icono: ShoppingCart
- "Agrega, modifica y elimina productos del carrito directamente desde el chat. Sincronizado con Shopify Storefront API y WooCommerce REST API."

**Feature 3 — Personalización Total**
- Icono: Palette
- "Colores, tipografía, avatar, mensajes de bienvenida, tono del asistente, idioma, preguntas sugeridas, badge promocional — todo configurable sin código."

**Feature 4 — Analytics de Conversión**
- Icono: BarChart
- "Mide el impacto real: recomendaciones, conversiones, revenue atribuido al AI, tasa de conversión, top productos. Dashboard completo."

**Feature 5 — Multimodal: Voz e Imágenes**
- Icono: Mic/Camera
- "Los clientes pueden enviar mensajes de voz (transcripción con Whisper) y fotos. El asistente entiende y responde inteligentemente."

**Feature 6 — Knowledge Base / RAG**
- Icono: BookOpen/Database
- "Sube documentos (PDF, TXT, MD) con información de tu marca. El asistente los usa como contexto para dar respuestas precisas y alineadas."

---

### Sección 6: Widget Showcase (Visual)
**Layout**: Gran mockup del widget con anotaciones/callouts
- Mostrar el widget con todas sus partes anotadas:
  - Header con avatar, nombre del agente, indicador "En línea"
  - Mensaje de bienvenida personalizado
  - Preguntas sugeridas (quick replies)
  - Conversación con producto recomendado (card con imagen, precio, botón)
  - Panel de carrito lateral
  - Badge promocional ("10% OFF")
  - Botón flotante con animación pulse
  - Input con adjuntos (audio, imagen)
- Tema claro + mención de tema oscuro disponible
- Texto: "Se adapta a la identidad de tu marca" con mini-previews de configuraciones de color diferentes

---

### Sección 7: Integraciones
**Layout**: Logo wall centrado sobre fondo blanco

**Plataformas soportadas** (mostrar logos oficiales):
- **Shopify** — Instalación en 1 clic via Theme Extension. Configuración desde el editor de temas.
- **WooCommerce** — Plugin WordPress dedicado. Setup wizard incluido.

**Tecnologías bajo el capó** (logos más pequeños, fila secundaria):
- OpenAI (GPT-4.1)
- Supabase (PostgreSQL + pgvector)
- Stripe (pagos)
- Retell AI (agentes de voz)

**Texto**: "Instalación en menos de 5 minutos. Sin código."

---

### Sección 8: Planes y Precios
**Layout**: 4 cards en fila, plan "Professional" destacado (borde púrpura + badge "Popular" + scale 1.05)
**Fondo**: --bg-warm (#f5f3f0)

#### Plan Free — $0/mes
- 100 mensajes AI/mes
- Hasta 50 productos
- Búsqueda semántica
- Gestión de carrito
- ✗ Analytics
- ✗ Branding personalizado
- ✗ Agentes de voz
- CTA: "Comenzar gratis" (outline)

#### Plan Starter — $149 USD/mes
- 1,000 mensajes AI/mes
- Hasta 500 productos
- Búsqueda semántica
- Gestión de carrito
- ✓ Analytics de conversión
- ✗ Branding personalizado
- ✗ Agentes de voz
- CTA: "Elegir Starter" (púrpura filled)

#### Plan Professional — $349 USD/mes ★ Popular
- 10,000 mensajes AI/mes
- Hasta 5,000 productos
- Búsqueda semántica
- Gestión de carrito
- ✓ Analytics de conversión
- ✓ Branding personalizado
- ✓ Soporte prioritario
- ✓ 100 llamadas de voz/mes
- CTA: "Elegir Professional" (púrpura filled, sombra)

#### Plan Enterprise — $599 USD/mes
- Mensajes ilimitados
- Productos ilimitados
- Todas las funcionalidades
- ✓ Acceso a API
- ✓ Llamadas de voz ilimitadas
- ✓ Soporte prioritario
- CTA: "Contactar ventas" (outline oscuro)

**Debajo de la tabla**: "Todos los planes incluyen trial de 14 días gratis. Sin tarjeta de crédito. Precios en USD."

---

### Sección 9: Early Access / Social Proof
**Layout**: Banner horizontal con fondo gradiente púrpura (de #6b5afc a #5849e0)
**Texto blanco**:
- Badge: "Early Access"
- Headline: "Únete a las marcas que ya venden más con IA"
- Subtexto: "Kova está en early access. Las primeras tiendas ya están generando conversiones medibles con nuestro asistente."
- Dato: "2 tiendas activas · 96 conversiones reales · $3M+ CLP en revenue atribuido"
- CTA: "Solicitar acceso" (botón blanco con texto púrpura)

**NO incluir**: Testimonios inventados, logos de empresas ficticias, números inflados.

---

### Sección 10: FAQ
**Layout**: Acordeón expandible, centrado, max-width 800px
**Idioma**: Español (el mercado principal es LATAM/España)

**Preguntas**:

**¿Qué es Kova?**
Kova es un asistente de compras con inteligencia artificial que se instala en tu tienda online (Shopify o WooCommerce). Usa búsqueda semántica para entender lo que tus clientes necesitan, recomienda productos relevantes y gestiona el carrito — todo dentro de un chat conversacional.

**¿Cómo se instala?**
En Shopify: instalación en 1 clic desde el Theme Editor (App Embeds). En WooCommerce: instala el plugin y completa el setup wizard. En ambos casos, el catálogo se sincroniza automáticamente. Todo el proceso toma menos de 5 minutos.

**¿Cómo se miden las conversiones?**
Kova trackea cada recomendación hecha por el AI. Cuando un cliente compra un producto recomendado dentro de una ventana de atribución, se registra como conversión. El dashboard muestra métricas reales: recomendaciones, conversiones, revenue atribuido, tasa de conversión y top productos.

**¿Puedo personalizar la apariencia del widget?**
Sí, completamente. Colores, avatar, mensajes de bienvenida, subtítulos, preguntas sugeridas, badge promocional, posición en pantalla, tamaño, tema claro/oscuro — todo configurable desde el panel de administración sin tocar código.

**¿En qué idiomas funciona?**
El asistente soporta múltiples idiomas. El idioma principal se configura por tienda (español, inglés, etc.) y el AI responde en el idioma del cliente automáticamente.

**¿Qué pasa con mis datos?**
Tus datos se almacenan de forma segura en Supabase (PostgreSQL) con aislamiento por tenant y row-level security. Las conversaciones, productos y configuraciones están protegidas y nunca se comparten entre tiendas.

**¿Necesito conocimientos técnicos?**
No. La instalación, configuración del widget, carga de knowledge base y gestión de planes se hace completamente desde la interfaz visual. No se requiere código.

**¿Puedo probar antes de pagar?**
Sí. Todos los planes incluyen un trial de 14 días gratis con acceso completo a todas las funciones. No se requiere tarjeta de crédito para comenzar.

---

### Sección 11: CTA Final
**Layout**: Sección de cierre centrada, fondo blanco, padding generoso
- Headline: "Empieza a vender más hoy"
- Subtexto: "Instala Kova en tu tienda en menos de 5 minutos. Trial de 14 días gratis."
- CTA: "Crear cuenta gratis" (botón grande púrpura con sombra)
- Debajo: "¿Preguntas? Escríbenos a [email de contacto]"

---

### Footer
- Logo Kova (texto)
- Links: Producto, Precios, Documentación, Contacto
- Links legales: Términos de servicio, Política de privacidad
- Social: (agregar cuando estén disponibles)
- Copyright: "© 2026 Kova. Todos los derechos reservados."

---

## 4. LINEAMIENTOS DE ANIMACIÓN

```
/* Framer Motion variants sugeridas */

// Fade up on scroll
fadeUp: { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } } }

// Stagger children (para grids de cards)
staggerContainer: { visible: { transition: { staggerChildren: 0.1 } } }

// Scale on hover (cards)
cardHover: { scale: 1.02, y: -4, transition: { duration: 0.3 } }

// Hero text reveal (word by word)
wordReveal: delay 0.05s entre palabras

// Counter animation (métricas)
Animar números de 0 al valor final en 1.5s con easing
```

---

## 5. SEO & META

```html
<title>Kova — Asistente de Ventas con IA para Shopify y WooCommerce</title>
<meta name="description" content="Kova es un asistente de compras con inteligencia artificial que se integra en tu tienda Shopify o WooCommerce. Búsqueda semántica, gestión de carrito y analytics de conversión.">
<meta property="og:title" content="Kova — Vende más con IA conversacional">
<meta property="og:description" content="Asistente de compras AI para e-commerce. Integración con Shopify y WooCommerce. Recomendaciones inteligentes, carrito integrado, analytics.">
<meta property="og:type" content="website">
```

---

## 6. RESPONSIVE

- **Desktop**: Layout completo (1200px max-width centrado)
- **Tablet (768-1024px)**: Grids de 2 columnas, hero apilado
- **Mobile (<768px)**: Todo single column, CTAs full-width, menú hamburguesa, pricing en carrusel horizontal o accordion

---

## 7. ASSETS NECESARIOS

Antes de desarrollar, necesitarás:
1. **Logo Kova** en SVG (versión clara y oscura)
2. **Video demo** del widget en acción (MP4 o link a YouTube/Vimeo)
3. **Screenshots/mockups** del widget en una tienda real
4. **Logos de Shopify y WooCommerce** (oficiales, SVG)
5. **Logos de tecnologías** (OpenAI, Supabase, Stripe) — opcional para la sección de integraciones
6. **Favicon** + Open Graph image (1200x630px)

---

## 8. NOTAS IMPORTANTES

- **Solo datos reales**: Todas las métricas provienen de la base de datos de producción. No inflar números.
- **Early access honesto**: No inventar testimonios ni logos de empresas cliente ficticias. Usar el approach "early access" con métricas reales.
- **Precios confirmados de la DB** (tabla `plans`, source of truth): Free $0, Starter $149, Professional $349, Enterprise $599 — todos USD/mes.
- **Video sobre demo interactiva**: La demo del producto se presenta en formato video, no como widget interactivo embebido en la landing.
- **Idioma principal**: Español. El mercado target es LATAM y España.
- **Domain**: app.heykova.io (backend/app actual).
