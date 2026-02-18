# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

## Project Overview

Naay Agent is a multi-platform AI commerce assistant. It integrates with **Shopify** and **WooCommerce** stores, providing semantic product search, cart management, and conversational commerce through an embeddable chat widget. The backend normalizes both platforms behind a unified commerce provider interface.

**Requirements**: Node.js 18+, npm, Supabase project, OpenAI API key. Shopify Partner account for Shopify integration.

## Development Commands

### Primary Commands (run from project root)
```bash
npm run dev                  # Start backend + admin concurrently
npm run dev:backend          # Backend only (tsx watch mode)
npm run dev:admin            # Admin panel only (Vite dev server on :3001)
npm run dev:shopify          # Shopify CLI dev (requires Shopify CLI)

npm run build                # Build all components
npm run build:backend        # Build backend (tsc + tsc-alias + asset copy)

npm run test                 # Run all tests
npm run test:backend         # Backend tests only

npm run lint                 # Lint TypeScript files
npm run lint:fix             # Auto-fix linting issues

npm run verify:sync          # Verify widget files synced between source/dist
npm run build:wp-plugin      # Build WooCommerce plugin ZIP
```

### Backend-Specific Commands (run from `backend/`)
```bash
npm run dev                  # Start with tsx watch mode
npm run build                # tsc → tsc-alias → copy public/ to dist/
npm run start                # Start production server

npm test                     # Run Jest tests
npm run test:watch           # Jest in watch mode
npm run test:coverage        # Generate coverage report

# Run single test file
npx jest path/to/test.ts

# Run tests matching pattern
npm test -- --testNamePattern="specific test name"

# Run specific test file with verbose output
npx jest backend/src/services/cache.service.test.ts --verbose
```

### Critical Configuration Notes
- **TypeScript strict mode**: `strict: true` in `tsconfig.json` (dev), but `strict: false` in `tsconfig.deployment.json` (production builds)
- **Path aliases**: Use `@/` prefix (e.g., `@/services/`, `@/types/`)
- **Environment files**: Located in `config/.env` (not `backend/.env`)
- **Build process**: Compilation → alias resolution (`tsc-alias`) → asset copying (`public/` to `dist/`)
- **Frontend-admin build**: Vite outputs to `../backend/public/app/` — the backend serves this as an SPA

## Architecture Overview

### Monorepo Structure
```
naay-agent/
├── backend/                 # Node.js/Express API (TypeScript)
│   ├── src/
│   │   ├── controllers/     # Route handlers (Express routers)
│   │   ├── services/        # Business logic
│   │   ├── platforms/       # Multi-platform abstraction (Shopify, WooCommerce)
│   │   ├── middleware/      # Auth, CORS, rate limiting, security, tenancy
│   │   ├── types/           # TypeScript definitions
│   │   └── utils/           # Utilities
│   └── public/              # Static assets (widget JS, admin SPA)
├── frontend-admin/          # Admin panel (React 18 + Vite + App Bridge)
├── extensions/              # Shopify theme extension (chat widget)
├── database/                # SQL schemas, migrations, functions
├── config/                  # Environment variables (.env)
├── scripts/                 # Setup and deployment automation
└── azure-config/            # Azure deployment configuration
```

### Request Flow & Middleware Chain

The Express app in `backend/src/index.ts` applies middleware in this order:

1. **Trust proxy** — Required for Azure App Service
2. **Per-prefix CORS** — Different CORS policies per route prefix (`/static`, `/api/widget`, `/api/chat`, `/api/simple-chat`, `/api/billing`, `/api/woo`, `/api/public`, `/api/admin`)
3. **Helmet** — Security headers (conditional — skipped for widget routes; iframe exceptions for Shopify/WooCommerce embeds)
4. **Rate limiting** — Endpoint-specific limits (chat: 30/min per session, webhooks: 1000/min per shop, default: 100/15min). Widget/public routes excluded.
5. **Security middleware** — `securityHeaders`, `sanitizeInput`, `auditLog`
6. **Raw body capture** — For webhook HMAC verification on `/api/webhooks`, `/api/stripe/webhooks`, `/api/woo/webhooks` (must come before JSON parsing)
7. **JSON/URL parsing** — 10MB limit
8. **Static file serving** — Widget JS, admin SPA, downloads
9. **Route handlers** — Controllers export Express Routers mounted via `app.use()`
10. **SPA fallback** — Non-API routes serve `backend/public/app/index.html` for React client-side routing

### Multi-Platform Commerce Abstraction (`backend/src/platforms/`)

The codebase supports both Shopify and WooCommerce through a provider pattern:

- **`interfaces/commerce.interface.ts`** — Defines `ICommerceProvider`, `ICartProvider`, `IAuthProvider` with normalized types (`NormalizedProduct`, `NormalizedOrder`, `NormalizedStore`)
- **`shopify/`** — Shopify implementation (Admin API + Storefront API)
- **`woocommerce/`** — WooCommerce implementation (REST API v3 with OAuth signature generation)
- **Factory registration** — `registerCommerceProvider('woocommerce', factory)` / `getCommerceProvider(platform, credentials)` for dynamic instantiation

Key difference: Shopify identifies stores by `*.myshopify.com` domain; WooCommerce uses full site URLs (e.g., `https://example.com`).

### Key Architectural Patterns
- **Controllers → Services → Supabase** (no repository layer)
- **Queue-based async processing** — BullMQ + Redis for product sync and embedding generation
- **Dual-layer caching** — Redis primary, in-memory fallback (via `cache.service.ts`)
- **Chat is HTTP request-response** — No WebSockets; no real-time streaming. Supports multimodal: audio (Whisper transcription) and image uploads with Supabase Storage persistence
- **`modern-shopify.service.ts`** extends `ShopifyService` adding session-token-based methods (App Bridge 3.0 pattern); both coexist
- **Inline Shopify provider** in `simple-chat.controller.ts` — Registers Shopify commerce provider using REST Admin API directly for product search/recommendations

### Multi-Tenancy

- **TenantService** (`backend/src/services/tenant.service.ts`) — Lookups by shop domain, 5-min Redis cache with `tenant:` prefix
- **Plan-based feature gating** — `plans` table (source of truth) + `TENANT_PLAN_LIMITS` (hardcoded fallback) control product limits, message limits, analytics access per plan (free/professional/enterprise)
- **Tenant middleware** (`middleware/tenant.middleware.ts`) — `validateShopContext` extracts shop from body, query, params, or `x-shopify-shop-domain` header. Also provides `trackMessageUsage()` and `requireFeature()` middlewares.
- **Request context** — Controllers access `(req as TenantRequest).tenant` for feature checks
- **Monthly message counting** — Direct query on `chat_messages` (role='agent', current month) with 60-sec Redis cache. Counts AI responses only (not user messages). Cache key: `tenant:monthly_msgs:{shopDomain}`

### Chat Message Persistence
- **`chat_messages` table** — `role: 'client'` for customer messages, `role: 'agent'` for AI responses
- **Backend inline persist** — `simple-chat.controller.ts` saves messages during chat request processing
- **Widget persist endpoint** — `POST /api/simple-chat/persist` for external chatbot persistence
- **Dual-persist guard** — Widget checks `chatEndpoint.includes('/api/simple-chat')` to skip its own persist call when backend already handles it (prevents duplicates)

### Frontend Admin (`frontend-admin/`)
- **React 18.2 + Vite** — Dev server on port 3001, proxies `/api` to localhost:3000
- **Page routing** — Public pages (Landing, Login, Register), Admin pages (Dashboard, Tenants, Settings), Client pages (ClientDashboard, MyStore, WidgetConfig, Analytics, KnowledgeBase, AiConfig, Subscription), Onboarding wizard
- **User-type routing** — Admin vs Client determines available page set
- **Embedded contexts** — `ShopifyEmbedded` component for Shopify Admin iframe; WooCommerce embedded views via `woo-embedded.controller.ts`
- **No frontend tests** — `npm run test:admin` is a no-op (`echo 'No tests configured'`)

### Database (Supabase + pgvector)
**Core Tables**: `shops`, `products`, `product_variants`, `product_embeddings`, `conversations`, `chat_messages`, `webhook_events`, `shopify_sessions`, `app_settings`, `client_stores`, `plans`, `knowledge_documents`, `knowledge_chunks`

- pgvector extension for semantic similarity search
- Row-level security for multi-tenant isolation
- Direct Supabase client calls (not abstracted through repositories)
- 18 migrations in `database/migrations/` (001–018, some non-sequential)
- Semantic search function: `database/functions/search_products_semantic.sql`
- **Supabase Storage buckets**: `chat-audio` (audio/webm, mp4, ogg, wav — 5MB limit), `chat-images` (jpeg, png, webp, gif — 2MB limit). Files uploaded via `supabaseService.uploadChatFile()`, public read access.
- **`client_stores`** is the primary table for per-tenant widget configuration (colors, messages, features). `stores` table holds platform credentials.

### Widget System

**Serving** (`widget.controller.ts`):
- Served at `/static/kova-widget.js` and `/widget/kova-widget.js`
- Dynamic file lookup across 4 possible paths (dist, build, cwd variations)
- Anti-cache headers (no-cache, max-age=0, ETag with timestamp)
- Legacy redirect: `naay-widget.js` → `kova-widget.js`
- Test pages in project root: `test-cart.html`, `test-cart-widget.html`, `test-cart-remove.html`

**Config endpoint** (`GET /api/widget/config?shop=`):
- Normalizes shop domain (strips paths, protocols, trailing slashes) and tries multiple variants
- Data source priority: `client_stores` → `stores` → `app_settings`
- Determines `chatEndpoint`: external mode uses `chatbot_endpoint` from DB; internal mode uses `/api/simple-chat/`
- Returns 50+ config fields (colors, messages, features, badge, contact toggle, etc.)

**Widget file** (`backend/public/kova-widget.js`):
- Single vanilla JS file (~7000 lines) — the embeddable chat widget
- `KovaWidget` class: constructor receives config, calls `loadSettings()` to fetch server config, then `createWidget()` to render
- CSS is injected dynamically via `<style>` tags (base styles + dynamic theme overrides)
- CSS variables: `--kova-perfect` (primary), `--kova-forever` (primary), `--kova-rich` (darker primary), `--kova-terracotta` (accent), `--kova-secondary`/`--kova-dark` (secondary)
- `applyDynamicStyles()` overrides base CSS variables with tenant-specific colors from server config

## Environment Configuration

Environment variables in `config/.env`:
```bash
# Required
SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_APP_URL
SUPABASE_URL, SUPABASE_SERVICE_KEY
OPENAI_API_KEY
JWT_SECRET

# Stripe Billing
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET

# Optional
REDIS_URL                    # Falls back to memory cache if unavailable
NODE_ENV=development|production
PORT=3000
```

## Testing & Debugging

### Manual Testing Endpoints
- `GET /health` — Basic health check
- `GET /health/detailed` — Comprehensive service status
- `POST /api/admin-bypass/products/sync` — Force product sync
- `GET /api/admin-bypass/stats` — System statistics

### Jest Configuration
- Coverage thresholds: 70% branches, 80% functions/lines/statements
- Test setup: `backend/src/test/setup.ts`
- Uses `tsconfig.test.json` for test compilation

## Knowledge Base

- **Service**: `knowledge.service.ts` — Uploads, chunks text (500 tokens, 50-token overlap), generates embeddings for RAG retrieval
- **Controller**: `knowledge.controller.ts` (`/api/knowledge/*`) — File upload (PDF/TXT/MD, 10MB limit via multer memory storage), CRUD for documents
- **Frontend**: `KnowledgeBase.tsx` client page
- **Tables**: `knowledge_documents`, `knowledge_chunks` (migration 016)
- **Cache**: `KNOWLEDGE_CACHE_TTL = 300` (5 min)

## Conversion Analytics

Multiple controllers/services handle conversion tracking at different levels:
- **`simple-conversion-analytics.controller.ts`** — Primary conversion analytics endpoints
- **`real-conversion-analyzer.controller.ts`** — Analyzes real conversions from order data
- **`historical-conversion-migrator.controller.ts`** — Backfills historical conversion data
- **Services**: `simple-conversion-tracker.service.ts`, `enhanced-conversion-analytics.service.ts`, `historical-conversion-analytics.service.ts`, `chat-conversions.service.ts`, `conversion-sync-scheduler.service.ts`

## Stripe Billing

- **Service**: `stripe.service.ts` — `getOrCreateCustomer()`, `createCheckoutSession()`, `createPortalSession()`, `constructEvent()`
- **Controllers**: `billing.controller.ts` (`/api/billing/*`), `stripe-webhook.controller.ts` (`/api/stripe/webhooks`)
- **`plans` table** is the source of truth for plan limits (has `stripe_price_id` column). `planService` reads with 5-min cache. `TENANT_PLAN_LIMITS` in `types/index.ts` is the hardcoded fallback.
- **Onboarding flow**: 6 steps (0=Platform, 1=Connect, 2=StoreInfo, 3=SelectPlan, 4=ConfigureWidget, 5=SyncAndActivate). Complete at step >= 6.
- Default registration plan: `free`

## Shopify Integration

### Authentication
- OAuth + session token hybrid (App Bridge 3.0)
- HMAC validation for webhooks
- JWT for internal session management

### Webhook Events
`products/create`, `products/update`, `products/delete`, `app/uninstalled`

### Theme Extension (`extensions/kova-chat-widget/`)
- `blocks/kova-chat.liquid` — Chat widget block (fully configurable from Shopify Theme Editor)
- `snippets/kova-*.liquid` — Injection scripts (init, body-inject, auto-inject)
- `shopify.extension.toml` — Extension config
- Widget config from Liquid is defaults only — server config (`/api/widget/config`) overrides at runtime

## WooCommerce Integration

### Authentication
- Store connection via WooCommerce REST API key validation (`woo-auth.controller.ts`)
- OAuth signature generation for API requests

### Controllers (`platforms/woocommerce/controllers/`)
- `woo-embedded.controller.ts` — Analytics/conversations/conversions for WC admin panel
- `woo-auth.controller.ts` — Store connection
- `woo-webhook.controller.ts` — Product/order webhook handlers
- `woo-plugin-update.controller.ts` — Plugin version management

## Deployment

- **Hosting**: Azure App Service
- **Config**: `azure-config/azure-deploy.json`, `startup.js`
- **CI/CD**: `.github/workflows/azure-deploy-*.yml` (push to `main` triggers deploy)
- **Build for Azure**: `npm run azure:setup`
- **Entry point**: `startup.js` (loads `backend/dist/index.js`)
- **Setup scripts**: `scripts/setup-supabase.sh` (DB init), `scripts/dev-setup.sh` (env check + deps)
