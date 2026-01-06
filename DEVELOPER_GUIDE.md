# 🛠️ Guía del Desarrollador - Naay Agent

Esta guía proporciona toda la información necesaria para desarrollar y mantener Naay Agent, un asistente conversacional de IA integrado con Shopify.

## 📋 Índice

1. [Configuración del Entorno](#configuración-del-entorno)
2. [Arquitectura del Proyecto](#arquitectura-del-proyecto)
3. [Desarrollo Local](#desarrollo-local)
4. [Testing](#testing)
5. [Base de Datos](#base-de-datos)
6. [Deployment](#deployment)
7. [Troubleshooting](#troubleshooting)

## 🚀 Configuración del Entorno

El entorno de desarrollo de Naay Agent está diseñado para ser modular y fácil de configurar. La aplicación utiliza tecnologías modernas que permiten escalabilidad y mantenimiento eficiente. Antes de comenzar, es importante entender que el proyecto integra múltiples servicios externos que deben configurarse correctamente.

### Prerrequisitos

```bash
# Versiones requeridas
Node.js >= 18.x
npm >= 9.x
Git
```

### Stack Tecnológico

Naay Agent utiliza un stack moderno y robusto diseñado para manejar aplicaciones de IA a escala. Cada componente fue seleccionado por su estabilidad, performance y facilidad de integración con Shopify.

- **Backend**: Node.js + Express + TypeScript (API principal con tipado fuerte)
- **Base de Datos**: Supabase (PostgreSQL + pgvector para búsqueda vectorial)
- **IA**: OpenAI GPT-4 + Embeddings (procesamiento de lenguaje natural)
- **Queue**: BullMQ + Redis (procesamiento asíncrono de tareas pesadas)
- **Testing**: Jest + Supertest (testing unitario e integración)
- **Shopify**: Admin API + Storefront API + Theme Extensions (integración completa)

### Configuración Inicial

El proceso de configuración está automatizado para minimizar la fricción al empezar a desarrollar. Los scripts incluidos se encargan de la mayor parte de la configuración, pero es importante entender cada paso para debugging y customización.

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd naay-agent
npm install
```

2. **Configurar variables de entorno**

Las variables de entorno están centralizadas en `config/.env` (no en `backend/.env` como es común). Esto facilita la gestión de configuración en un monorepo y evita duplicación.

```bash
cp config/.env.example config/.env
```

3. **Variables de entorno críticas**

Estas variables son fundamentales para el funcionamiento del sistema. El archivo `backend/src/utils/config.ts` valida todas las variables críticas al arrancar y proporciona mensajes de error detallados si falta alguna.
```env
# Shopify (obligatorio)
SHOPIFY_API_KEY=tu_api_key_de_shopify
SHOPIFY_API_SECRET=tu_secret_de_shopify
SHOPIFY_APP_URL=https://tu-dominio.ngrok.io

# Supabase (obligatorio)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=service_role_key_aqui

# OpenAI (obligatorio)
OPENAI_API_KEY=sk-...

# Redis (opcional - fallback a memoria)
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true

# Configuración general
NODE_ENV=development
PORT=3000
JWT_SECRET=tu_jwt_secret_seguro
```

4. **Configurar Supabase**

Este script automatiza la creación del esquema de base de datos, instalación de extensiones (como pgvector), y configuración de Row Level Security. También crea las funciones SQL necesarias para búsqueda semántica.

```bash
./scripts/setup-supabase.sh
```

## 🏗️ Arquitectura del Proyecto

Naay Agent sigue una arquitectura de monorepo con separación clara de responsabilidades. El diseño está orientado a facilitar el desarrollo, testing y deployment independiente de cada componente, mientras mantiene la integración fluida entre servicios.

### Estructura de Directorios

```
naay-agent/
├── backend/                    # API principal
│   ├── src/
│   │   ├── controllers/       # Endpoints HTTP
│   │   ├── services/          # Lógica de negocio
│   │   ├── middleware/        # Middleware Express
│   │   ├── types/            # Tipos TypeScript
│   │   └── utils/            # Utilidades
│   ├── public/               # Assets estáticos
│   └── tests/               # Tests de integración
├── frontend-admin/            # Panel administrativo
├── extensions/               # Shopify theme extensions
├── database/                # Esquemas y migraciones
├── scripts/                 # Scripts de automatización
└── config/                  # Variables de entorno
```

### Componentes Principales

La aplicación está diseñada con una arquitectura de servicios que separa claramente la lógica de negocio de los controladores HTTP. Esto facilita el testing, mantenimiento y escalabilidad del sistema.

#### Backend Services
- **ai-agent.service.ts**: Motor de IA y chat conversacional
- **shopify.service.ts**: Integración con APIs de Shopify  
- **supabase.service.ts**: Operaciones de base de datos
- **embedding.service.ts**: Generación de embeddings vectoriales
- **cache.service.ts**: Cache Redis con fallback a memoria
- **queue.service.ts**: Procesamiento asíncrono con BullMQ

#### Controllers

Los controladores actúan como la capa de presentación del API, manejando requests HTTP y delegando la lógica de negocio a los servicios. Cada controlador tiene una responsabilidad específica y bien definida.

- **auth.controller.ts**: OAuth de Shopify y autenticación de sesiones
- **chat.controller.ts**: Endpoints del chat IA y procesamiento de mensajes
- **product.controller.ts**: Sincronización de productos y búsqueda semántica
- **webhook.controller.ts**: Webhooks de Shopify con validación HMAC
- **widget.controller.ts**: API pública para el widget de chat embebido

### Flujo de Datos

El flujo de datos está diseñado para optimizar performance y user experience. Las búsquedas vectoriales se cachean agresivamente, y el procesamiento de IA se realiza de forma asíncrona cuando es posible.

```
Cliente → Widget → Backend API → Supabase
                    ↓
                 OpenAI API → Respuesta IA
                    ↓
                 Cache Redis → Widget
```

El sistema implementa múltiples capas de cache y fallbacks para garantizar disponibilidad incluso cuando algunos servicios externos están degradados.

## 💻 Desarrollo Local

El entorno de desarrollo está optimizado para productividad máxima. Utiliza hot reloading en todos los componentes, watch mode para tests, y scripts automatizados que minimizan la fricción entre iteraciones de desarrollo.

### Comandos Principales

```bash
# Desarrollo completo (recomendado)
npm run dev                    # Inicia backend + admin

# Servicios individuales
npm run dev:backend           # Solo backend API
npm run dev:admin            # Solo panel admin
npm run dev:shopify          # Solo Shopify CLI

# Build y producción
npm run build                # Build completo
npm run build:backend        # Solo backend
npm run start               # Producción
```

### Backend Específico

El backend utiliza `tsx` para hot reloading rápido durante desarrollo, y un sistema de build en múltiples pasos que garantiza robustez en producción. El proceso de build incluye compilación TypeScript, resolución de path aliases, y copia de assets estáticos.

```bash
cd backend

# Desarrollo
npm run dev                  # tsx watch mode
npm run build               # Build seguro (recomendado)
npm run build:safe          # Alias de build
npm run start              # Servidor de producción

# Testing
npm test                   # Todos los tests
npm run test:watch         # Watch mode
npm run test:coverage      # Reporte de cobertura

# Linting
npm run lint              # ESLint
npm run lint:fix          # Auto-fix
```

### Configuración de TypeScript

**Importante**: El proyecto tiene strict mode deshabilitado por compatibilidad con dependencias legacy, pero se recomienda usar tipado fuerte en código nuevo. Esto requiere especial atención a type casting y validación en runtime.

- **Strict mode deshabilitado** (`strict: false`) - ten cuidado con tipos
- **Path aliases**: Usa `@/` para imports (ej: `@/services/shopify`)
- **Múltiples configuraciones**:
  - `tsconfig.json` - Desarrollo
  - `tsconfig.deployment.json` - Producción
  - `tsconfig.test.json` - Testing

### Variables de Configuración

El sistema de configuración centralizado proporciona validación robusta y mensajes de error claros. Todas las variables críticas se validan al arranque, evitando fallos silenciosos en runtime.

El sistema valida configuración en `backend/src/utils/config.ts`:

```typescript
// Ejemplo de uso
import { config } from '@/utils/config';

console.log(config.shopify.apiKey);
console.log(config.supabase.url);
```

## 🧪 Testing

La estrategia de testing está diseñada para proporcionar confianza en los cambios mientras mantiene velocidad de ejecución. Se enfoca en unit tests para lógica de negocio y integration tests para APIs críticas. El sistema de coverage asegura calidad mínima sin ser demasiado restrictivo.

### Configuración Jest

- **Framework**: Jest + ts-jest
- **Entorno**: Node.js
- **Coverage objetivo**: 80% lines/functions, 70% branches
- **Timeout**: 10 segundos
- **Setup**: `backend/src/test/setup.ts`

### Estructura de Tests

La organización de tests sigue el patrón de co-locación: cada directorio de código tiene su correspondiente directorio `__tests__`. Esto facilita el mantenimiento y hace que los tests sean fáciles de encontrar y actualizar.

```bash
backend/src/
├── services/__tests__/        # Unit tests de servicios
├── controllers/__tests__/     # Unit tests de controllers  
├── middleware/__tests__/      # Unit tests de middleware
└── test/                     # Setup y helpers
```

### Comandos de Testing

Los comandos de testing están optimizados para diferentes workflows de desarrollo. El watch mode es útil durante desarrollo activo, mientras que el reporte de coverage es esencial antes de hacer commits.

```bash
# Tests completos
npm run test                   # Backend + admin
npm run test:backend          # Solo backend
npm run test:watch            # Watch mode

# Tests específicos
npm test -- --testNamePattern="nombre del test"
npx jest path/to/test.js

# Coverage
npm run test:coverage         # Reporte HTML en coverage/
```

### Ejemplos de Tests

Los tests están diseñados para ser legíbles y mantenibles. Se usan mocks para servicios externos (OpenAI, Shopify) y test databases para integración. Cada test debe ser independiente y determinista.

```typescript
// Unit test ejemplo
describe('EmbeddingService', () => {
  it('should generate embeddings for product', async () => {
    const service = new EmbeddingService();
    const embedding = await service.generateEmbedding('test product');
    expect(embedding).toHaveLength(1536);
  });
});

// Integration test ejemplo
describe('POST /api/chat/message', () => {
  it('should respond to chat message', async () => {
    const response = await request(app)
      .post('/api/chat/message')
      .send({ message: 'Hi', shopId: 'test-shop' });
    
    expect(response.status).toBe(200);
    expect(response.body.response).toBeDefined();
  });
});
```

### Testing Local del Widget

El testing del widget requiere un entorno que simule la integración con una tienda Shopify. Los archivos de test HTML permiten probar la funcionalidad completa del widget sin necesidad de una tienda real.

```bash
# Servir archivos de test
cd backend
npm run dev

# Abrir en navegador:
http://localhost:3000/test-cart.html
http://localhost:3000/test-widget.html
```

## 🗄️ Base de Datos

La base de datos utiliza Supabase (PostgreSQL) con extensión pgvector para búsqueda semántica. El diseño está optimizado para multi-tenancy con Row Level Security y performance de búsquedas vectoriales. Todas las tablas implementan isolación por tienda para garantizar seguridad de datos.

### Esquema Principal

```sql
-- Tablas principales
shops                    -- Configuración de tiendas
products                -- Catálogo sincronizado  
product_variants        -- Variantes de productos
product_embeddings      -- Vectores para búsqueda semántica
conversations          -- Historial de chat
webhook_events         -- Log de webhooks
```

### Migraciones

Las migraciones están organizadas secuencialmente y son idempotentes. Cada migración incluye verificaciones de estado previo y rollback instructions. El sistema soporta tanto migraciones manuales como automatizadas.

```bash
# Ejecutar migraciones
cd database
psql -h <supabase-host> -U postgres -f migrations/001_initial_schema.sql

# O usando el script
cd scripts
node run-migration.ts
```

### Operaciones Comunes

Las operaciones de base de datos utilizan el cliente de Supabase con tipado fuerte cuando es posible. Para búsquedas vectoriales se usan remote procedure calls (RPC) que encapsulan la complejidad de pgvector.

```typescript
// Búsqueda semántica
const products = await supabase
  .from('products')
  .select('*')
  .rpc('search_products_semantic', { 
    query_text: 'summer dress',
    similarity_threshold: 0.7,
    limit_count: 10 
  });

// Cache con Redis fallback
const cachedData = await cacheService.get('products:123');
await cacheService.set('products:123', data, 3600);
```

### Row Level Security (RLS)

RLS es fundamental para la seguridad multi-tenant. Cada tabla tiene políticas que garantizan que una tienda solo pueda acceder a sus propios datos. Esto proporciona aislamiento a nivel de base de datos sin necesidad de lógica adicional en el backend.

- **Habilitado** en todas las tablas
- **Multi-tenant** por `shop_id`
- **Políticas automáticas** para aislamiento de datos

## 🚀 Deployment

El proceso de deployment está diseñado para ser confiable y reproducible. Incluye validaciones pre-deployment, builds optimizados para producción, y health checks post-deployment. El sistema soporta tanto deployment manual como CI/CD automatizado.

### Preparación para Producción

```bash
# Build completo
npm run build

# Verificar assets sincronizados  
npm run verify:sync

# Lint antes de deploy
npm run lint
```

### Variables de Entorno Producción

Las variables de producción deben configurarse cuidadosamente, especialmente las URLs públicas y conexiones a servicios externos. Todas las secrets deben manejarse a través de sistemas seguros de gestión de configuración.

```env
NODE_ENV=production
PORT=3000
SHOPIFY_APP_URL=https://tu-app-real.com
REDIS_URL=redis://prod-redis:6379
# ... resto de variables
```

### Deployment en Azure

Azure App Service proporciona el entorno de hosting principal. El deployment incluye configuración automatizada de web.config, variables de entorno, y health checks. Los scripts automatizados manejan la mayor parte de la configuración.

```bash
# Configuración Azure
./scripts/deploy-to-azure.sh

# O manual
az webapp deployment source config-zip \
  --resource-group myResourceGroup \
  --name myapp \
  --src naay-agent-deploy.zip
```

### Health Checks

Los health checks proporcionan visibilidad del estado del sistema en producción. Incluyen verificaciones de conectividad a servicios externos, estado de la base de datos, y availability de APIs críticas.

```bash
# Health básico
GET /health

# Health detallado  
GET /health/detailed

# Respuesta esperada
{
  "status": "healthy",
  "timestamp": "2023-...",
  "services": {
    "database": "connected",
    "redis": "connected", 
    "openai": "available"
  }
}
```

## 🛠️ Troubleshooting

Esta sección cubre los problemas más frecuentes durante desarrollo y producción. Cada problema incluye diagnóstico paso a paso y múltiples soluciones alternativas. Los comandos de debug están optimizados para proporcionar información útil rápidamente.

### Problemas Comunes

#### 1. Error de Conexión Supabase
```bash
# Verificar variables
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_KEY

# Test de conexión
curl -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
     "$SUPABASE_URL/rest/v1/shops?select=*"
```

#### 2. Redis no Disponible
```bash
# El sistema fallback a memoria automáticamente
# Para verificar:
redis-cli ping
# O deshabilitar Redis:
REDIS_ENABLED=false
```

#### 3. OpenAI Rate Limits
```typescript
// Configurar retry en services
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 30000
});
```

#### 4. Build Fails
```bash
# Build seguro paso a paso
cd backend
npm run build:compile    # Solo TypeScript
npm run build:alias      # Resolver aliases  
npm run build:assets     # Copiar archivos estáticos
```

#### 5. Tests Failing
```bash
# Limpiar cache
npm test -- --clearCache

# Test específico con logs
npm test -- --verbose path/to/test.js

# Sin coverage para debug
npm test -- --coverage=false
```

### Debug Mode

El sistema de debug utiliza logs estructurados y variables de entorno para controlar el nivel de detalle. En desarrollo, los logs son verbosos para facilitar debugging. En producción, se optimizan para performance y storage.

```bash
# Variables de debug
DEBUG=naay:* npm run dev
NODE_ENV=development npm run dev

# Logs detallados
tail -f backend/logs/combined.log
tail -f backend/logs/error.log
```

### Performance Monitoring

El monitoring de performance se integra directamente en el código para capturar métricas en tiempo real. Es especialmente importante para operaciones de IA y búsquedas vectoriales que pueden tener latencia variable.

```typescript
// Métricas en código
import { performanceMonitor } from '@/utils/performance-monitor';

const timer = performanceMonitor.startTimer('database_query');
const result = await supabase.from('products').select('*');
timer.end();
```

## 📚 Recursos Adicionales

### Documentación Técnica
- [CLAUDE.md](./CLAUDE.md) - Instrucciones para IA
- [docs/](./docs/) - Documentación detallada
- [backend-architecture.md](./backend-architecture.md) - Arquitectura backend

### APIs de Referencia
- [Shopify Admin API](https://shopify.dev/docs/admin-api)
- [Supabase Docs](https://supabase.com/docs)
- [OpenAI API](https://platform.openai.com/docs)

### Scripts Útiles
- `./scripts/dev-setup.sh` - Setup inicial
- `./scripts/setup-supabase.sh` - Configurar BD
- `./scripts/deploy-to-azure.sh` - Deploy automático

---

**💡 Tip**: Mantén esta guía actualizada cuando hagas cambios significativos en la arquitectura o configuración del proyecto.