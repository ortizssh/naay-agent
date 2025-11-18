# Backend Architecture - Naay Agent

## 1. Project Structure

```
naay-agent-backend/
├── src/
│   ├── config/                     # Configuration management
│   │   ├── database.ts             # Database connection config
│   │   ├── shopify.ts             # Shopify API configuration
│   │   ├── supabase.ts           # Supabase client configuration
│   │   └── environment.ts         # Environment variables validation
│   │
│   ├── controllers/               # HTTP request handlers
│   │   ├── auth.controller.ts     # OAuth flow handlers
│   │   ├── webhook.controller.ts  # Shopify webhooks
│   │   ├── sync.controller.ts     # Catalog synchronization
│   │   ├── chat.controller.ts     # AI chat endpoints
│   │   └── admin.controller.ts    # Admin panel endpoints
│   │
│   ├── services/                  # Business logic layer
│   │   ├── auth/
│   │   │   ├── oauth.service.ts   # OAuth implementation
│   │   │   └── jwt.service.ts     # JWT token management
│   │   │
│   │   ├── shopify/
│   │   │   ├── admin-api.service.ts    # Admin GraphQL API
│   │   │   ├── storefront-api.service.ts # Storefront GraphQL API
│   │   │   ├── webhook.service.ts      # Webhook processing
│   │   │   └── cart.service.ts         # Cart operations
│   │   │
│   │   ├── ai/
│   │   │   ├── orchestrator.service.ts # AI orchestration
│   │   │   ├── intent.service.ts       # Intent detection
│   │   │   ├── rag.service.ts         # RAG implementation
│   │   │   ├── embeddings.service.ts   # Vector embeddings
│   │   │   └── action.service.ts       # Action execution
│   │   │
│   │   ├── sync/
│   │   │   ├── catalog.service.ts      # Product synchronization
│   │   │   ├── queue.service.ts        # Job queue management
│   │   │   └── batch.service.ts        # Batch processing
│   │   │
│   │   └── database/
│   │       ├── product.service.ts      # Product data operations
│   │       ├── shop.service.ts         # Shop data operations
│   │       └── analytics.service.ts    # Analytics and logging
│   │
│   ├── models/                    # Data models and types
│   │   ├── database/
│   │   │   ├── shop.model.ts      # Shop entity
│   │   │   ├── product.model.ts   # Product entity
│   │   │   ├── variant.model.ts   # Product variant entity
│   │   │   ├── embedding.model.ts # Vector embedding entity
│   │   │   └── conversation.model.ts # Chat conversations
│   │   │
│   │   ├── shopify/
│   │   │   ├── admin-api.types.ts # Admin API types
│   │   │   ├── storefront-api.types.ts # Storefront API types
│   │   │   └── webhook.types.ts   # Webhook payload types
│   │   │
│   │   └── ai/
│   │       ├── intent.types.ts    # Intent detection types
│   │       ├── action.types.ts    # Action execution types
│   │       └── rag.types.ts       # RAG response types
│   │
│   ├── middleware/                # Express middleware
│   │   ├── auth.middleware.ts     # Authentication middleware
│   │   ├── validation.middleware.ts # Request validation
│   │   ├── rate-limit.middleware.ts # Rate limiting
│   │   ├── error.middleware.ts    # Error handling
│   │   └── logging.middleware.ts  # Request logging
│   │
│   ├── routes/                    # API route definitions
│   │   ├── auth.routes.ts         # OAuth routes
│   │   ├── webhook.routes.ts      # Webhook endpoints
│   │   ├── sync.routes.ts         # Synchronization endpoints
│   │   ├── chat.routes.ts         # AI chat endpoints
│   │   └── admin.routes.ts        # Admin panel routes
│   │
│   ├── utils/                     # Utility functions
│   │   ├── crypto.util.ts         # Cryptographic utilities
│   │   ├── validation.util.ts     # Data validation helpers
│   │   ├── graphql.util.ts        # GraphQL query builders
│   │   ├── retry.util.ts          # Retry mechanism
│   │   └── logger.util.ts         # Logging utilities
│   │
│   ├── workers/                   # Background job workers
│   │   ├── sync-worker.ts         # Product sync jobs
│   │   ├── embedding-worker.ts    # Embedding generation
│   │   └── webhook-worker.ts      # Webhook processing
│   │
│   ├── migrations/                # Database migrations
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_add_embeddings.sql
│   │   └── 003_add_analytics.sql
│   │
│   └── app.ts                     # Express application setup
│
├── tests/                         # Test suites
│   ├── unit/                      # Unit tests
│   ├── integration/               # Integration tests
│   └── e2e/                       # End-to-end tests
│
├── docs/                          # Documentation
│   ├── api.md                     # API documentation
│   ├── deployment.md              # Deployment guide
│   └── architecture.md            # Architecture overview
│
├── scripts/                       # Utility scripts
│   ├── setup-db.ts               # Database setup
│   ├── seed-data.ts              # Test data seeding
│   └── deploy.ts                 # Deployment script
│
├── docker/                        # Docker configuration
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── docker-compose.prod.yml
│
├── .env.example                   # Environment variables template
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## 2. Core Data Models

### Shop Model
```typescript
export interface Shop {
  id: string;
  domain: string;
  access_token: string;
  scopes: string[];
  plan: string;
  timezone: string;
  currency: string;
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
  webhook_endpoints: WebhookEndpoint[];
}
```

### Product Model
```typescript
export interface Product {
  id: string;
  shop_id: string;
  shopify_id: string;
  title: string;
  description_html: string;
  description_text: string;
  vendor: string;
  product_type: string;
  tags: string[];
  handle: string;
  images: ProductImage[];
  status: 'active' | 'archived' | 'draft';
  created_at: Date;
  updated_at: Date;
  variants: ProductVariant[];
}
```

### Vector Embedding Model
```typescript
export interface ProductEmbedding {
  id: string;
  product_id: string;
  variant_id?: string;
  embedding: number[];  // Vector embedding
  content_type: 'product' | 'variant' | 'description';
  content_text: string;
  metadata: Record<string, any>;
  model_version: string;
  created_at: Date;
}
```

## 3. Architecture Patterns

### 1. Clean Architecture
- **Domain Layer**: Core business entities and interfaces
- **Application Layer**: Use cases and orchestration
- **Infrastructure Layer**: External services (Shopify, Supabase, AI)
- **Presentation Layer**: Controllers and API endpoints

### 2. Event-Driven Architecture
- **Event Bus**: Redis/BullMQ for job queues
- **Event Handlers**: Webhook processing, sync jobs
- **Saga Pattern**: Multi-step operations (sync + embeddings)

### 3. Repository Pattern
```typescript
interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  findByShop(shopId: string): Promise<Product[]>;
  save(product: Product): Promise<Product>;
  delete(id: string): Promise<void>;
  searchSemantic(query: string, limit: number): Promise<Product[]>;
}
```

### 4. Dependency Injection
```typescript
export class Container {
  private services = new Map<string, any>();

  register<T>(token: string, implementation: T): void {
    this.services.set(token, implementation);
  }

  resolve<T>(token: string): T {
    return this.services.get(token);
  }
}
```

## 4. Error Handling & Resilience

### Error Classification
```typescript
export enum ErrorType {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  EXTERNAL_API = 'EXTERNAL_API',
  DATABASE = 'DATABASE',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  RATE_LIMIT = 'RATE_LIMIT'
}

export class AppError extends Error {
  constructor(
    message: string,
    public type: ErrorType,
    public statusCode: number,
    public isOperational = true
  ) {
    super(message);
  }
}
```

### Circuit Breaker Pattern
```typescript
export class CircuitBreaker {
  private failures = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private nextAttempt = Date.now();

  constructor(
    private threshold: number,
    private timeout: number,
    private monitor: (error: Error) => boolean
  ) {}

  async call<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.nextAttempt <= Date.now()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }
}
```

### Retry Mechanism
```typescript
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries: number;
    backoffMs: number;
    shouldRetry: (error: Error) => boolean;
  }
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === options.maxRetries || !options.shouldRetry(error)) {
        throw error;
      }
      
      await sleep(options.backoffMs * Math.pow(2, attempt));
    }
  }
  
  throw lastError!;
}
```

## 5. Scalability Considerations

### Horizontal Scaling
- **Stateless Services**: No server-side session storage
- **Load Balancing**: Multiple backend instances
- **Database Connection Pooling**: PgBouncer for Supabase

### Caching Strategy
```typescript
export class CacheService {
  constructor(
    private redis: Redis,
    private defaultTTL: number = 3600
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.redis.setex(
      key, 
      ttl || this.defaultTTL, 
      JSON.stringify(value)
    );
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

### Queue Management
```typescript
export class SyncQueue {
  private queue: Queue;

  constructor() {
    this.queue = new Queue('product-sync', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 50,
        attempts: 3,
        backoff: 'exponential'
      }
    });
  }

  async addSyncJob(shopId: string, productIds?: string[]): Promise<void> {
    await this.queue.add('sync-products', {
      shopId,
      productIds,
      timestamp: Date.now()
    });
  }
}
```

### Database Optimization
```sql
-- Indexes for performance
CREATE INDEX CONCURRENTLY idx_products_shop_id ON products(shop_id);
CREATE INDEX CONCURRENTLY idx_products_updated_at ON products(updated_at);
CREATE INDEX CONCURRENTLY idx_embeddings_product_id ON product_embeddings(product_id);

-- Vector similarity search index
CREATE INDEX CONCURRENTLY idx_embeddings_vector 
ON product_embeddings USING ivfflat (embedding vector_cosine_ops);

-- Partial indexes for active products
CREATE INDEX CONCURRENTLY idx_products_active 
ON products(shop_id) WHERE status = 'active';
```

### Rate Limiting
```typescript
export class RateLimiter {
  constructor(private redis: Redis) {}

  async checkLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number }> {
    const pipeline = this.redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, Math.ceil(windowMs / 1000));
    
    const results = await pipeline.exec();
    const current = results[0][1] as number;
    
    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current)
    };
  }
}
```

## 6. Security Best Practices

### JWT Token Management
```typescript
export class JWTService {
  private readonly algorithm = 'HS256';
  
  sign(payload: object, expiresIn: string = '1h'): string {
    return jwt.sign(payload, process.env.JWT_SECRET!, {
      algorithm: this.algorithm,
      expiresIn
    });
  }

  verify(token: string): any {
    return jwt.verify(token, process.env.JWT_SECRET!, {
      algorithms: [this.algorithm]
    });
  }
}
```

### Request Validation
```typescript
export const validateShopifyWebhook = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const body = JSON.stringify(req.body);
  const signature = req.headers['x-shopify-hmac-sha256'];
  
  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET!)
    .update(body)
    .digest('base64');
  
  if (hash !== signature) {
    return res.status(401).json({ error: 'Unauthorized webhook' });
  }
  
  next();
};
```

This architecture provides a solid foundation for your Shopify AI agent with proper separation of concerns, scalability considerations, and robust error handling. Each component is designed to be testable, maintainable, and production-ready.