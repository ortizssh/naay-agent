# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

## Project Overview

Naay Agent is a multi-platform AI commerce assistant. It integrates with **Shopify** and **WooCommerce** stores, providing semantic product search, cart management, and conversational commerce through an embeddable chat widget. The backend normalizes both platforms behind a unified commerce provider interface.

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

1. **Per-prefix CORS** — Different CORS policies per route prefix (`/static`, `/api/widget`, `/api/chat`, `/api/woo`, `/api/public`, `/api/admin`)
2. **Helmet** — Security headers (with iframe exceptions for Shopify/WooCommerce embeds)
3. **Rate limiting** — Endpoint-specific limits (chat: 30/min per session, webhooks: 1000/min per shop, default: 100/15min)
4. **Security middleware** — XSS sanitization, script tag prevention, event handler stripping
5. **Raw body capture** — For webhook HMAC signature verification (must come before JSON parsing)
6. **JSON/URL parsing** — 10MB limit
7. **Route handlers** — Controllers export Express Routers mounted via `app.use()`
8. **SPA fallback** — Non-API routes serve `backend/public/app/index.html` for React client-side routing

### Multi-Platform Commerce Abstraction (`backend/src/platforms/`)

The codebase supports both Shopify and WooCommerce through a provider pattern:

- **`interfaces/commerce.interface.ts`** — Defines `ICommerceProvider`, `ICartProvider`, `IAuthProvider` with normalized types (`NormalizedProduct`, `NormalizedOrder`, `NormalizedStore`)
- **`shopify/`** — Shopify implementation (Admin API + Storefront API)
- **`woocommerce/`** — WooCommerce implementation (REST API v3 with OAuth signature generation)
- **Factory registration** — `registerCommerceProvider('woocommerce', factory)` / `getCommerceProvider(platform, credentials)` for dynamic instantiation

Key difference: Shopify identifies stores by `*.myshopify.com` domain; WooCommerce uses full site URLs (e.g., `https://example.com`).

### Key Architectural Patterns
- **Controllers → Services → Supabase** (no repository layer)
- **Type casting** used in some services: `(supabaseService as any).serviceClient`
- **Queue-based async processing** — BullMQ + Redis for product sync and embedding generation
- **Dual-layer caching** — Redis primary, in-memory fallback (via `cache.service.ts`)
- **Chat is HTTP request-response** — No WebSockets; no real-time streaming
- **`modern-shopify.service.ts`** extends `ShopifyService` adding session-token-based methods (App Bridge 3.0 pattern); both coexist

### Multi-Tenancy

- **TenantService** (`backend/src/services/tenant.service.ts`) — Lookups by shop domain, 5-min Redis cache with `tenant:` prefix
- **Plan-based feature gating** — `TENANT_PLAN_LIMITS` controls product limits, message limits, analytics access per plan (free/professional/enterprise)
- **Tenant middleware** (`middleware/tenant.middleware.ts`) — `validateShopContext` ensures request shop matches authenticated shop; extracts shop from body, query, params, or `x-shopify-shop-domain` header
- **Request context** — Controllers access `(req as TenantRequest).tenant` for feature checks

### Frontend Admin (`frontend-admin/`)
- **React 18.2 + Vite** — Dev server on port 3001, proxies `/api` to localhost:3000
- **Page routing** — Public pages (Landing, Login, Register), Admin pages (Dashboard, Tenants, Settings), Client pages (MyStore, WidgetConfig, Analytics), Onboarding wizard
- **User-type routing** — Admin vs Client determines available page set
- **Embedded contexts** — `ShopifyEmbedded` component for Shopify Admin iframe; WooCommerce embedded views via `woo-embedded.controller.ts`

### Database (Supabase + pgvector)
**Core Tables**: `shops`, `products`, `product_variants`, `product_embeddings`, `conversations`, `webhook_events`, `shopify_sessions`, `app_settings`

- pgvector extension for semantic similarity search
- Row-level security for multi-tenant isolation
- Direct Supabase client calls (not abstracted through repositories)
- Migrations in `database/migrations/`
- Semantic search function: `database/functions/search_products_semantic.sql`

### Widget Serving
- Served at `/static/kova-widget.js` and `/widget/kova-widget.js`
- Dynamic file lookup across 4 possible paths (dist, build, cwd variations)
- Anti-cache headers (no-cache, max-age=0, ETag with timestamp)
- Legacy redirect: `naay-widget.js` → `kova-widget.js`
- Test pages in project root: `test-cart.html`, `test-cart-widget.html`, `test-cart-remove.html`

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
- `GET /health` — Basic health check
- `GET /health/detailed` — Comprehensive service status
- `POST /api/admin-bypass/products/sync` — Force product sync
- `GET /api/admin-bypass/stats` — System statistics

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

### Theme Extension (`extensions/kova-chat-widget/`)
- `blocks/kova-chat.liquid` — Chat widget block
- `snippets/kova-*.liquid` — Injection scripts (init, body-inject, auto-inject)
- `shopify.extension.toml` — Extension config

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
