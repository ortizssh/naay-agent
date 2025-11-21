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
# Start all development services
npm run dev

# Start individual services
npm run dev:backend          # Backend API server
npm run dev:admin           # Admin frontend panel  
npm run dev:shopify         # Shopify app development

# Build commands
npm run build               # Build all components
npm run build:backend       # Build backend only
npm run build:admin         # Build admin panel only

# Testing
npm run test                # Run all tests
npm run test:backend        # Backend tests only
npm run test:admin          # Frontend tests only

# Linting and code quality
npm run lint                # Lint TypeScript files
npm run lint:fix            # Auto-fix linting issues

# Shopify commands
npm run shopify:generate    # Generate Shopify extensions
npm run shopify:deploy      # Deploy Shopify app
npm run shopify:info        # Show app info
```

### Backend-Specific Commands
```bash
cd backend

# Development
npm run dev                 # Start with tsx watch mode
npm run build               # Build TypeScript to dist/
npm run start               # Start production server

# Testing  
npm test                    # Run Jest tests
npm run test:watch          # Jest in watch mode
npm run test:coverage       # Generate coverage report

# Single test commands
npm test -- --testNamePattern="specific test name"
npx jest path/to/test.js    # Run single test file
```

### Critical Configuration Notes
- TypeScript strict mode is **disabled** (`strict: false`) - be aware when making type changes
- Path aliases use `@/` prefix (e.g., `@/services/`, `@/types/`)
- Environment config validation in `backend/src/utils/config.ts` with detailed error logging

## Architecture Overview

### Monorepo Structure
- **Root level**: Workspace configuration, shared scripts, Shopify app config
- **backend/**: Node.js/Express API with TypeScript
- **frontend-admin/**: Admin panel (App Bridge integration)
- **extensions/naay-chat-widget/**: Shopify theme extension
- **database/**: SQL schemas, migrations, functions
- **docs/**: Technical documentation
- **scripts/**: Automation and setup scripts

### Key Technologies
- **Backend**: Node.js, Express, TypeScript
- **Database**: Supabase (PostgreSQL + pgvector for embeddings)
- **AI**: OpenAI GPT-4 + embeddings for semantic search
- **Queue**: BullMQ + Redis for background jobs
- **Auth**: Shopify OAuth + JWT sessions
- **Shopify**: Admin API, Storefront API, webhooks, theme extensions

### Core Services Architecture

**Controllers Layer** (`backend/src/controllers/`)
- `auth.controller.ts` - Shopify OAuth flow
- `webhook.controller.ts` - Shopify webhook handlers  
- `chat.controller.ts` - AI chat endpoints
- `product.controller.ts` - Product sync and search
- `widget.controller.ts` - Widget integration endpoints
- `admin.controller.ts` - Admin panel APIs
- `admin-bypass.controller.ts` - Direct admin operations

**Services Layer** (`backend/src/services/`)
- `ai-agent.service.ts` - AI orchestration and chat logic
- `shopify.service.ts` - Shopify API interactions
- `modern-shopify.service.ts` - Modern Shopify auth patterns
- `supabase.service.ts` - Database operations
- `embedding.service.ts` - Vector embeddings generation
- `queue.service.ts` - Background job management
- `cart.service.ts` - Shopping cart operations
- `cache.service.ts` - Redis caching with memory fallback

**Key Patterns**
- Clean architecture with separation of concerns
- Repository pattern for data access
- Service layer for business logic
- Queue-based async processing for product sync
- Event-driven webhook processing
- Type casting used extensively in services (requires careful refactoring)
- Dual-layer caching (Redis + memory fallback) for resilience

### Database Schema

**Core Tables**:
- `shops` - Shopify store configurations and tokens
- `products` - Synchronized product catalog
- `product_variants` - Product variant details  
- `product_embeddings` - Vector embeddings for semantic search
- `conversations` - Chat session history
- `webhook_events` - Webhook processing log

**Database Access Patterns**:
- Direct Supabase client calls in services (not abstracted through repositories)
- Type casting used for database operations: `(supabaseService as any).serviceClient`
- Row-level security policies enforce multi-tenant data isolation

**Key Features**:
- pgvector extension for similarity search
- Row-level security for multi-tenancy
- Automated sync via webhooks
- Background job processing for embeddings

### AI Agent System

**Intent Detection**: Classifies user messages into categories:
- Product search and discovery
- Cart operations (add/remove/view)
- Store information queries
- General conversation

**Semantic Search**: Uses OpenAI embeddings + pgvector for:
- Product title and description matching
- Category and attribute filtering
- Similarity-based recommendations

**Action Execution**: Handles e-commerce actions:
- Cart management via Storefront API
- Product recommendations
- Store policy information
- Order status inquiries

## Development Workflow

### Local Setup
1. Run `./scripts/dev-setup.sh` or `npm install` in root
2. Configure environment variables in `config/.env`
3. Setup Supabase: `./scripts/setup-supabase.sh`
4. Start services: `npm run dev`

### Testing Strategy
- Unit tests for services and utilities
- Integration tests for API endpoints  
- Webhook testing via admin bypass endpoints
- Chat testing through widget interface

### Code Quality
- ESLint configuration for TypeScript
- Prettier for consistent formatting
- Husky pre-commit hooks
- TypeScript strict mode enabled

## Important Configuration Files

### Environment Configuration
- `config/.env` - Main environment variables
- `backend/src/utils/config.ts` - Configuration validation
- `shopify.app.toml` - Shopify app configuration

### Key Environment Variables
```bash
# Shopify
SHOPIFY_API_KEY=           # From Partner Dashboard
SHOPIFY_API_SECRET=        # From Partner Dashboard  
SHOPIFY_APP_URL=           # Your app domain
SHOPIFY_SCOPES=            # App permissions

# Supabase
SUPABASE_URL=              # Project URL
SUPABASE_SERVICE_KEY=      # Service role key

# OpenAI
OPENAI_API_KEY=            # API key for GPT-4 + embeddings
OPENAI_MODEL=              # Optional: gpt-4 (default)
EMBEDDING_MODEL=           # Optional: text-embedding-3-small (default)

# Redis (Optional - falls back to memory cache)
REDIS_URL=                 # Full Redis connection string (preferred)
REDIS_HOST=localhost       # Redis host (fallback)
REDIS_PORT=6379           # Redis port (fallback)
REDIS_PASSWORD=           # Redis password (if required)
REDIS_ENABLED=true        # Set to 'false' to disable Redis

# Runtime
NODE_ENV=development|production
PORT=3000
JWT_SECRET=               # JWT signing secret
```

### TypeScript Configuration
- Root `tsconfig.json` for workspace
- `backend/tsconfig.json` for backend compilation
- `backend/tsconfig.deployment.json` for production builds

## Deployment Architecture

### Production Stack
- **Hosting**: Azure App Service (configured in azure-config/)
- **Database**: Supabase hosted PostgreSQL
- **CDN**: Static widget files via Azure/CDN
- **Monitoring**: Built-in health checks and logging

### Key Deployment Files
- `azure-config/azure-deploy.json` - Azure deployment template
- `azure-config/startup.js` - Azure startup script
- `scripts/deploy-to-azure.sh` - Deployment automation
- `.github/workflows/` - CI/CD pipeline

### Health Monitoring
- `/health` - Basic health check
- `/health/detailed` - Comprehensive service status
- Structured logging with Winston
- Error tracking and alerting

## Shopify Integration Specifics

### Modern Authentication (2024)
- App Bridge 3.0 with session tokens
- OAuth + session token hybrid flow
- HMAC validation for webhooks
- JWT for internal session management

### Theme Extension Structure
```
extensions/naay-chat-widget/
├── blocks/naay-chat.liquid      # Chat widget block
├── snippets/
│   ├── naay-auto-inject.liquid  # Auto-injection snippet
│   ├── naay-body-inject.liquid  # Body injection script
│   └── naay-init.liquid         # Widget initialization
├── locales/en.default.json      # Translations
└── shopify.extension.toml       # Extension config
```

### Webhook Events
- `products/create` - New product sync
- `products/update` - Product updates
- `products/delete` - Product removal
- `app/uninstalled` - Cleanup on uninstall

## Testing and Quality Assurance

### Manual Testing Endpoints
- `POST /api/admin-bypass/products/sync` - Force product sync
- `GET /api/admin-bypass/stats` - System statistics
- `POST /api/admin-bypass/settings/update` - Update widget config
- `GET /health/detailed` - Comprehensive health check

### Widget Testing
- Test in Shopify theme preview
- Verify CORS configuration for cross-domain loading
- Check responsive behavior across devices
- Validate chat functionality and cart operations

### Common Issues to Check
- CORS headers for widget script loading
- Webhook HMAC validation
- OpenAI API rate limits and token usage
- Supabase connection pooling
- Redis availability for queue processing

### Code Quality Considerations
- **Type Safety**: Many service methods use `(service as any)` type casting - requires careful refactoring
- **Error Handling**: Inconsistent error handling patterns across controllers - some use try/catch, others rely on middleware
- **Validation**: Webhook verification uses manual header parsing - consider using middleware
- **Cache Implementation**: Redis service has extensive type casting that should be refactored for better type safety

## Performance Considerations

### Backend Optimization
- Connection pooling for database
- Redis caching for frequently accessed data
- Background job processing for heavy operations
- Rate limiting on API endpoints

### AI Performance
- Embedding caching to reduce OpenAI calls
- Vector search index optimization
- Batch processing for product embeddings
- Response streaming for real-time chat

### Frontend Optimization
- Widget lazy loading
- Minimal JavaScript bundle size
- Cached assets via CDN
- Progressive enhancement patterns

This architecture supports a production-ready Shopify AI assistant with proper scalability, security, and maintainability patterns.