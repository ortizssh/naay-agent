# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

## Project Overview

Naay Agent is a Shopify AI assistant that combines a Node.js backend, Shopify theme extensions, and AI-powered chat capabilities. It provides semantic product search, cart management, and conversational commerce through a chat widget that integrates directly into Shopify stores.

## Development Commands

### Primary Commands
```bash
npm run dev                  # Start backend + admin concurrently
npm run dev:backend          # Backend only (tsx watch mode)
npm run dev:admin            # Admin panel only
npm run dev:shopify          # Shopify CLI dev (requires Shopify CLI)

npm run build                # Build all components
npm run build:backend        # Build backend (tsc + alias + assets)

npm run test                 # Run all tests
npm run test:backend         # Backend tests only

npm run lint                 # Lint TypeScript files
npm run lint:fix             # Auto-fix linting issues

npm run verify:sync          # Verify widget files synced between source/dist
```

### Backend-Specific Commands (run from `backend/`)
```bash
npm run dev                  # Start with tsx watch mode
npm run build                # Safe build: tsc + alias resolution + asset copy
npm run start                # Start production server

npm test                     # Run Jest tests
npm run test:watch           # Jest in watch mode
npm run test:coverage        # Generate coverage report

# Run single test
npm test -- --testNamePattern="specific test name"
npx jest path/to/test.ts
```

### Critical Configuration Notes
- **TypeScript strict mode**: `strict: true` in `tsconfig.json` (dev), but `strict: false` in `tsconfig.deployment.json` (production builds)
- **Path aliases**: Use `@/` prefix (e.g., `@/services/`, `@/types/`)
- **Environment files**: Located in `config/.env` (not `backend/.env`)
- **Build process**: Compilation → alias resolution (`tsc-alias`) → asset copying (`public/` to `dist/`)

## Architecture Overview

### Monorepo Structure
```
naay-agent/
├── backend/                 # Node.js/Express API (TypeScript)
├── frontend-admin/          # Admin panel (Shopify App Bridge)
├── extensions/              # Shopify theme extension (chat widget)
├── database/                # SQL schemas, migrations, functions
├── config/                  # Environment variables (.env)
├── scripts/                 # Automation scripts
└── azure-config/            # Azure deployment configuration
```

### Core Services (`backend/src/services/`)
- `ai-agent.service.ts` - AI orchestration, intent detection, chat logic
- `shopify.service.ts` - Shopify Admin & Storefront API interactions
- `supabase.service.ts` - Database operations
- `embedding.service.ts` - OpenAI embeddings generation
- `queue.service.ts` - BullMQ background job management
- `cart.service.ts` - Shopping cart operations via Storefront API
- `cache.service.ts` - Redis caching with memory fallback
- `*-analytics.service.ts` - Conversion tracking and analytics

### Controllers (`backend/src/controllers/`)
- `auth.controller.ts` - Shopify OAuth flow
- `webhook.controller.ts` - Shopify webhook handlers
- `chat.controller.ts` / `simple-chat.controller.ts` - AI chat endpoints
- `product.controller.ts` - Product sync and search
- `admin-bypass.controller.ts` - Direct admin operations (testing/debugging)
- `health.controller.ts` - Health check endpoints

### Key Patterns
- Controllers → Services → Supabase (no repository layer)
- Type casting used in some services: `(supabaseService as any).serviceClient`
- Queue-based async processing for product sync and embeddings
- Dual-layer caching: Redis primary, memory fallback

### Database (Supabase + pgvector)
**Core Tables**: `shops`, `products`, `product_variants`, `product_embeddings`, `conversations`, `webhook_events`

- pgvector extension for semantic similarity search
- Row-level security for multi-tenant isolation
- Direct Supabase client calls (not abstracted through repositories)

## Environment Configuration

Environment variables in `config/.env`:
```bash
# Required
SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_APP_URL
SUPABASE_URL, SUPABASE_SERVICE_KEY
OPENAI_API_KEY
JWT_SECRET

# Optional
REDIS_URL                    # Falls back to memory cache if unavailable
NODE_ENV=development|production
PORT=3000
```

## Testing & Debugging

### Manual Testing Endpoints
- `GET /health` - Basic health check
- `GET /health/detailed` - Comprehensive service status
- `POST /api/admin-bypass/products/sync` - Force product sync
- `GET /api/admin-bypass/stats` - System statistics

### Widget Testing
- Use `test-cart.html` or `test-cart-widget.html` in root for local testing
- Widget served from `backend/public/naay-widget.js`

### Jest Configuration
- Coverage thresholds: 70% branches, 80% functions/lines/statements
- Test setup: `backend/src/test/setup.ts`
- Uses `tsconfig.test.json` for test compilation

## Shopify Integration

### Authentication
- OAuth + session token hybrid (App Bridge 3.0)
- HMAC validation for webhooks
- JWT for internal session management

### Webhook Events
`products/create`, `products/update`, `products/delete`, `app/uninstalled`

### Theme Extension (`extensions/naay-chat-widget/`)
- `blocks/naay-chat.liquid` - Chat widget block
- `snippets/naay-*.liquid` - Injection scripts
- `shopify.extension.toml` - Extension config

## Deployment

- **Hosting**: Azure App Service
- **Config**: `azure-config/azure-deploy.json`, `startup.js`
- **CI/CD**: `.github/workflows/`
- **Build for Azure**: `npm run azure:setup`