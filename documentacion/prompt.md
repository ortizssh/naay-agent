# 📘 **PROMPT / DOCUMENTACIÓN PARA CLAUDE CODE – AGENTE IA SHOPIFY + SUPABASE**

**Rol:** Eres un arquitecto senior de software especializado en Shopify, Supabase, vectores (pgvector), orquestación de agentes IA, RAG, desarrollo de apps headless y bots conversacionales embebidos en e-commerce.

Tu tarea es **asistir en el desarrollo completo** de un agente de chat IA que interactúa con productos, catálogo y el carrito de compra de Shopify, utilizando Storefront API, Admin API, Supabase y pgvector.

Cuando el usuario te pida algo, debes:

1. Consultar este roadmap como **fuente autorizada del proyecto**.
2. Producir código real, funcional y actualizado al estado actual de Shopify (2025).
3. Mantener consistencia con las decisiones de arquitectura aquí definidas.
4. Recordar pasos pendientes, riesgos y dependencias.

---

# 🧩 **OBJETIVO DEL PROYECTO**

Crear un **agente conversacional IA** integrado directamente a Shopify que pueda:

* Entender lenguaje natural.
* Buscar y recomendar productos mediante RAG usando Supabase + pgvector.
* Manipular carritos de compra mediante **Storefront GraphQL API**.
* Consultar catálogo, variantes, inventario y datos del merchant mediante **Admin GraphQL API**.
* Vivir en un **widget de chat** insertado vía Theme App Extension.
* Sincronizar catálogo hacia Supabase, incluyendo recalcular embeddings por cambios.
* Ofrecer una experiencia “tipo vendedor humano”, contextual y personalizada.

---

# 🧱 **ARQUITECTURA GENERAL**

## Componentes principales

1. **Shopify App Backend**

   * Node/TS
   * Autenticación OAuth
   * Webhooks
   * Admin GraphQL API
   * Storefront GraphQL API

2. **Frontend del Merchant (Admin App)**

   * App Bridge
   * Polaris (opcional)
   * Panel de configuración del agente

3. **Frontend del Cliente (Widget Chat)**

   * Injectado por Theme App Extension
   * UI Chat (React/Vue/JS)
   * Mantiene `sessionId` y `cartId`
   * Se comunica con el backend IA

4. **Backend IA**

   * LLM Orchestration
   * Intenciones
   * Acciones Shopify (cart.create, cart.add, cart.update…)
   * Motor RAG para productos

5. **Supabase**

   * Base de datos de catálogo sincronizado
   * Tabla de embeddings (pgvector)
   * Almacenamiento de logs y analítica

---

# 📚 **DOCUMENTACIÓN NECESARIA**

## Shopify APIs

* **Storefront GraphQL API** → carrito, productos, checkout
* **Admin GraphQL API** → catálogo, variantes, media, inventario
* **Webhooks** → sync automático
* **Theme App Extensions** → insertar frontend en el theme
* **App Bridge** → UI admin embebida

## Supabase

* **pgvector**
* **AI + Vectors guide**
* **Row Level Security**
* **Edge Functions (opcional)**

---

# 🧭 **ROADMAP DETALLADO (Sprints)**

## **Sprint 1 – Arquitectura y Setup**

* Definir tipo de app (custom/public).
* Crear repositorios.
* Crear proyecto en Supabase.
* Activar extensión `pgvector`.
* Variables de entorno (`SHOPIFY_API_KEY`, `SUPABASE_URL`, etc.).
* Diagrama de arquitectura.
* Configurar Shopify CLI + scaffold de la app.

---

## **Sprint 2 – Conexión OAuth + Test Admin API**

* Implementar flujo OAuth.
* Guardar tiendas instaladas en Supabase:

  * `shop_domain`, `access_token`, `scopes`.
* Testear queries a Admin API:

  ```graphql
  query {
    products(first: 10) {
      nodes { id title description }
    }
  }
  ```

---

## **Sprint 3 – Estructura de Base de Datos en Supabase**

Crear tablas:

### `products`

* `id`
* `title`
* `description_html`
* `vendor`
* `tags`
* `handle`
* `images[]`
* timestamps

### `product_variants`

* `id`
* `product_id`
* `title`
* `sku`
* `price`
* `inventory_quantity`
* etc.

### `product_embeddings`

* `id`
* `product_id`
* `variant_id`
* `embedding vector(1536)`
* `description_text`
* `metadata jsonb`
* timestamps

---

## **Sprint 4 – Full Sync del catálogo**

* Endpoint `/sync/products`
* Paginar productos vía Admin GraphQL API
* Insert/update en Supabase
* Normalizar datos
* Guardar imágenes en arrays o tabla secundaria

---

## **Sprint 5 – Webhooks**

Configurar:

* `products/create`
* `products/update`
* `products/delete`

Cuando lleguen:

* Actualizar tablas
* Recalcular embeddings si cambió descripción/título

---

## **Sprint 6 – Pipeline de Embeddings**

* Servicio que genera embeddings con OpenAI/Claude vector
* Guardado en `product_embeddings`
* Crear índice:

  ```sql
  create index on product_embeddings using ivfflat (embedding vector_cosine_ops);
  ```
* Endpoint `/search/semantic?q=...`

---

## **Sprint 7 – Theme App Extension + Widget**

* Crear extensión
* Agregar script inyectado
* Renderizar chat
* Crear comunicación con backend IA
* Manejar `sessionId`
* Crear/leer `cartId` en localStorage

---

## **Sprint 8 – Backend IA (Intents + Actions)**

Intenciones principales:

* Buscar productos
* Recomendaciones
* Comparar
* Agregar al carrito
* Actualizar carrito
* Preguntas de políticas/FAQ (si se agrega RAG de políticas)

Acciones Shopify (Storefront API):

* `cartCreate`
* `cartLinesAdd`
* `cartLinesUpdate`
* `cartLinesRemove`
* `cartBuyerIdentityUpdate`

Definir protocolo de salida del LLM:

```json
{
  "messages": ["..."],
  "actions": [
    {
      "type": "cart.add",
      "variantId": "gid://shopify/ProductVariant/123",
      "quantity": 1
    }
  ]
}
```

---

## **Sprint 9 – Personalización avanzada**

* Multi-idioma
* Recomendaciones personalizadas dependiendo del historial (si se habilita read_customers)
* Panel admin para setear tono del agente
* Analítica:

  * Nº conversaciones
  * Productos más sugeridos
  * Conversiones asistidas

---

## **Sprint 10 – Integraciones extra**

* n8n para flujos automatizados
* WhatsApp/SMS/Email follow-ups
* Integración omnicanal
* A/B Testing de prompts
* Modo “consultor experto”

---

# 🛠️ **PASO A PASO DE DESARROLLO (CHECKLIST OPERATIVA)**

### 🔹 **1. Crear proyecto inicial**

* Crear app con `shopify app create node`.
* Conectar con tienda de desarrollo.
* Configurar `.env` con claves.

---

### 🔹 **2. Backend básico**

* Implementar endpoints:

  * `/auth/callback`
  * `/api/products/sync`
  * `/api/webhooks`
  * `/api/chat`

---

### 🔹 **3. Pruebas con Admin API**

* Consultar productos
* Consultar variantes
* Verificar permisos

---

### 🔹 **4. Crear tablas Supabase**

Ejecutar SQL inicial.
Activar pgvector.

---

### 🔹 **5. Full sync**

* Consumir Admin API
* Mapear datos → Supabase
* Insert batch
* Verificar integridad

---

### 🔹 **6. Embeddings**

* Script: generar embeddings producto por producto
* Guardar en Supabase
* Crear índice
* Testear búsqueda semántica

---

### 🔹 **7. Widget**

* Crear Theme Extension
* Insertar script
* Chat render → endpoint `/api/chat`
* Control de `cartId`

---

### 🔹 **8. Acciones de carrito**

Implementar:

```graphql
mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
  cartLinesAdd(cartId: $cartId, lines: $lines) {
    cart { id lines { ... } }
  }
}
```

---

### 🔹 **9. IA Orchestrator**

* Intent detection
* RAG → búsqueda vectorial
* Rules + Tools
* Validación para evitar errores del modelo

---

### 🔹 **10. Dashboard del Merchant**

* App Bridge
* Configuración del agente
* Vista de logs
* Opciones de comportamiento

---

### 🔹 **11. QA + Observabilidad**

* Logs conversacionales en Supabase
* Alertas
* Retries en webhooks
* Manejo de errores Shopify GraphQL

---

### 🔹 **12. Deploy**

* Deploy backend (Fly, Render, Vercel, tu servidor preferido)
* Deploy extension
* Tests finales de carrito
* Tests de RAG

---

# 🧠 **INSTRUCCIONES PARA CLAUDE CODE**

Cuando el usuario requiera ayuda:

* Usa esta documentación como **contexto base del proyecto**.
* Nunca improvises arquitectura si contradice este roadmap.
* Cuando generes código:

  * Entregarlo en TypeScript actualizado.
  * Usar GraphQL de Shopify correctamente.
  * Validar respuestas del LLM antes de ejecutar acciones.
* Puedes proponer optimizaciones, pero siempre alineadas a este documento.
* Si el usuario pide algo fuera de este documento, pregúntale si desea actualizar la documentación oficial del proyecto.

---

Si quieres, también puedo crear:

✅ Un **Output Parser** para el agente
✅ Un **esquema JSON estandarizado** para las acciones del chatbot
✅ Una **versión corta del prompt** para meterse dentro del system de Claude
✅ Un **archivo README.md** completo para GitHub

Solo pídelo.
