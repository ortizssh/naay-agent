# 🤖 Naay Agent - Shopify AI Assistant

Un agente conversacional inteligente integrado con Shopify que utiliza Supabase + pgvector para búsqueda semántica de productos y recomendaciones personalizadas.

## 🌟 Características

- 🛍️ **Integración completa con Shopify** - Admin API y Storefront API
- 🧠 **Inteligencia Artificial** - Búsqueda semántica con OpenAI embeddings
- 💬 **Chat conversacional** - Widget embebido en el tema de Shopify
- 🛒 **Gestión de carrito** - Agregar, actualizar y gestionar productos
- ⚡ **Sincronización automática** - Catálogo listo inmediatamente tras instalación
- 📊 **Analytics avanzado** - Seguimiento de conversaciones y conversiones
- 🔄 **Updates en tiempo real** - Webhooks para mantener datos actualizados

## 🏗️ Arquitectura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Supabase      │
│   (Chat Widget) │◄──►│   (Node.js)     │◄──►│   + pgvector    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Shopify APIs  │
                       │   Admin + Store │
                       └─────────────────┘
```

## 🚀 Instalación Rápida

### Prerrequisitos

- Node.js 18+
- npm o yarn
- Cuenta de Shopify Partner
- Proyecto en Supabase
- API Key de OpenAI

### 1. Clonar y configurar

```bash
git clone <repository-url>
cd naay-agent
npm install
```

### 2. Configurar variables de entorno

```bash
cp config/.env.example config/.env
```

Edita `config/.env` con tus credenciales:

```env
# Shopify
SHOPIFY_API_KEY=tu_api_key
SHOPIFY_API_SECRET=tu_api_secret
SHOPIFY_APP_URL=https://tu-dominio.com

# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=tu_service_key

# OpenAI
OPENAI_API_KEY=tu_openai_key
```

### 3. Configurar Supabase

```bash
# Instalar Supabase CLI (si no lo tienes)
npm install -g supabase

# Ejecutar setup
./scripts/setup-supabase.sh
```

### 4. Iniciar desarrollo

```bash
npm run dev
```

## ⚡ Sincronización Automática

**¡No requiere configuración adicional!** 

Al instalar la app en una tienda Shopify:

1. ✅ **OAuth automático** - Se autentica con la tienda
2. ✅ **Sincronización inmediata** - Descarga todo el catálogo en background
3. ✅ **Embeddings generados** - Búsqueda semántica lista al instante
4. ✅ **Webhooks configurados** - Mantiene sincronizado en tiempo real
5. ✅ **Agente listo** - Chat funcional desde el primer momento

> 📖 Ver documentación detallada: [docs/AUTO_SYNC.md](./docs/AUTO_SYNC.md)

## 📚 Estructura del Proyecto

```
naay-agent/
├── backend/                 # API Node.js + TypeScript
│   ├── src/
│   │   ├── controllers/     # Controladores de rutas
│   │   ├── services/        # Lógica de negocio
│   │   ├── middleware/      # Middleware Express
│   │   ├── types/          # Definiciones TypeScript
│   │   └── utils/          # Utilidades
│   └── package.json
├── frontend-admin/          # Panel de admin (App Bridge)
├── frontend-widget/         # Widget de chat (Theme Extension)
├── database/               # Migraciones y funciones SQL
│   ├── migrations/         # Esquemas de base de datos
│   └── functions/          # Funciones de Supabase
├── docs/                   # Documentación técnica
├── config/                 # Variables de entorno
└── scripts/               # Scripts de automatización
```

## 🔧 Desarrollo

### Comandos principales

```bash
# Desarrollo completo (todos los servicios)
npm run dev

# Solo backend
npm run dev:backend

# Solo frontend admin
npm run dev:admin

# Solo widget
npm run dev:widget

# Build completo
npm run build

# Tests
npm run test

# Linting
npm run lint
```

### Scripts útiles

```bash
# Configurar Supabase
./scripts/setup-supabase.sh

# Sincronizar productos de Shopify
npm run sync:products

# Generar embeddings
npm run generate:embeddings
```

## 🛠️ APIs Disponibles

### Autenticación
```http
GET /auth/install?shop=tienda.myshopify.com
GET /auth/callback
GET /auth/me
```

### Productos
```http
GET /api/products/sync
GET /api/products/search?q=query
GET /api/products/recommendations
```

### Chat
```http
POST /api/chat/message
GET /api/chat/session/:id/history
```

### Webhooks
```http
POST /api/webhooks/products/create
POST /api/webhooks/products/update
POST /api/webhooks/products/delete
```

## 🎯 Roadmap

### ✅ Sprint 1 - Arquitectura y Setup
- [x] Estructura base del proyecto
- [x] Configuración de Shopify OAuth
- [x] Integración con Supabase + pgvector
- [x] APIs básicas de autenticación

### ✅ Sprint 2 - Sincronización Automática
- [x] Sync completo del catálogo (automático post-instalación)
- [x] Webhooks de productos (create/update/delete)
- [x] Generación de embeddings (background jobs)
- [x] Búsqueda semántica (pgvector + OpenAI)
- [x] Queue system (BullMQ + Redis)

### 📋 Sprint 3 - Chat Widget
- [ ] Theme App Extension
- [ ] Interface de chat
- [ ] Integración con backend IA
- [ ] Gestión de sesiones

### 🤖 Sprint 4 - Motor de IA
- [ ] Detección de intenciones
- [ ] Acciones de carrito
- [ ] Recomendaciones personalizadas
- [ ] Validación de respuestas

### 📊 Sprint 5 - Analytics y Optimización
- [ ] Dashboard de métricas
- [ ] A/B testing de prompts
- [ ] Optimización de rendimiento
- [ ] Monitoreo en tiempo real

## 🔒 Seguridad

- **HMAC Validation** para webhooks de Shopify
- **JWT** para autenticación de sesiones
- **Row Level Security** en Supabase
- **Rate Limiting** en todas las APIs
- **Input Sanitization** en el chat

## 📈 Monitoreo

- **Health checks** en `/health`
- **Structured logging** con Winston
- **Error tracking** integrado
- **Performance metrics** para queries vectoriales

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama feature (`git checkout -b feature/nueva-caracteristica`)
3. Commit los cambios (`git commit -am 'Agregar nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Crear Pull Request

## 📄 Licencia

MIT License - ver `LICENSE` para detalles.

## 🆘 Soporte

- 📖 **Documentación**: [./docs](./docs)
- 🐛 **Issues**: [GitHub Issues](../../issues)
- 💬 **Discord**: [Servidor de la comunidad](#)

---

**Desarrollado con ❤️ para la comunidad de Shopify**