# Deployment Configuration - Naay Agent Backend

## Docker Configuration

### Dockerfile
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies and TypeScript files
RUN npm prune --production && rm -rf src/

USER nodejs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/app.js"]
```

### docker-compose.yml (Development)
```yaml
version: '3.8'

services:
  naay-backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - PORT=3000
    env_file:
      - .env
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  # Optional: Local PostgreSQL for testing
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: naay_agent_test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  redis_data:
  postgres_data:
```

### docker-compose.prod.yml (Production)
```yaml
version: '3.8'

services:
  naay-backend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    env_file:
      - .env.production
    restart: always
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
        reservations:
          memory: 512M
          cpus: '0.25'
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  redis:
    image: redis:7-alpine
    restart: always
    volumes:
      - redis_data:/data
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.25'
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - naay-backend
    restart: always

volumes:
  redis_data:
```

## Environment Configuration

### .env.example
```env
# Application
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Database (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project.supabase.co:5432/postgres

# Shopify Configuration
SHOPIFY_API_KEY=your-shopify-api-key
SHOPIFY_API_SECRET=your-shopify-api-secret
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret
SHOPIFY_REDIRECT_URI=https://your-domain.com/auth/callback
SHOPIFY_API_VERSION=2024-01

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_SECRET=your-refresh-token-secret

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password

# AI/ML Services
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring
SENTRY_DSN=your-sentry-dsn
PROMETHEUS_PORT=9090

# External Services
WEBHOOK_BASE_URL=https://your-domain.com
CORS_ORIGINS=https://your-frontend.com,https://admin.shopify.com
```

## Kubernetes Configuration

### namespace.yaml
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: naay-agent
---
apiVersion: v1
kind: Secret
metadata:
  name: naay-secrets
  namespace: naay-agent
type: Opaque
data:
  # Base64 encoded environment variables
  SUPABASE_SERVICE_ROLE_KEY: <base64-encoded-value>
  SHOPIFY_API_SECRET: <base64-encoded-value>
  JWT_SECRET: <base64-encoded-value>
  OPENAI_API_KEY: <base64-encoded-value>
```

### deployment.yaml
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: naay-backend
  namespace: naay-agent
spec:
  replicas: 3
  selector:
    matchLabels:
      app: naay-backend
  template:
    metadata:
      labels:
        app: naay-backend
    spec:
      containers:
      - name: naay-backend
        image: your-registry/naay-backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: SUPABASE_URL
          value: "https://your-project.supabase.co"
        - name: SUPABASE_SERVICE_ROLE_KEY
          valueFrom:
            secretKeyRef:
              name: naay-secrets
              key: SUPABASE_SERVICE_ROLE_KEY
        - name: SHOPIFY_API_KEY
          value: "your-api-key"
        - name: SHOPIFY_API_SECRET
          valueFrom:
            secretKeyRef:
              name: naay-secrets
              key: SHOPIFY_API_SECRET
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 60
          periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: naay-backend-service
  namespace: naay-agent
spec:
  selector:
    app: naay-backend
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: naay-agent
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
---
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: naay-agent
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
  type: ClusterIP
```

### ingress.yaml
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: naay-backend-ingress
  namespace: naay-agent
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  tls:
  - hosts:
    - api.naay-agent.com
    secretName: naay-backend-tls
  rules:
  - host: api.naay-agent.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: naay-backend-service
            port:
              number: 80
```

## CI/CD Pipeline (GitHub Actions)

### .github/workflows/deploy.yml
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run type checking
      run: npm run type-check
    
    - name: Run tests
      run: npm test
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
        REDIS_URL: redis://localhost:6379
        NODE_ENV: test
    
    - name: Run integration tests
      run: npm run test:integration
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
        REDIS_URL: redis://localhost:6379
        NODE_ENV: test

  security-scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Run security audit
      run: npm audit --audit-level=high
    
    - name: Run Snyk security scan
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  build-and-push:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
    
    - name: Login to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        push: true
        tags: |
          ghcr.io/${{ github.repository }}:latest
          ghcr.io/${{ github.repository }}:${{ github.sha }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Deploy to Kubernetes
      uses: azure/k8s-deploy@v1
      with:
        manifests: |
          k8s/deployment.yaml
          k8s/service.yaml
          k8s/ingress.yaml
        images: |
          ghcr.io/${{ github.repository }}:${{ github.sha }}
        kubectl-version: 'latest'
        kubeconfig: ${{ secrets.KUBE_CONFIG }}
    
    - name: Verify deployment
      run: |
        kubectl rollout status deployment/naay-backend -n naay-agent
        kubectl get services -n naay-agent
```

## Monitoring and Observability

### Health Check Endpoint
```typescript
// src/routes/health.routes.ts
import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { redis } from '../config/redis';

const router = Router();

router.get('/health', async (req: Request, res: Response) => {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {
      database: 'unknown',
      redis: 'unknown',
      memory: process.memoryUsage(),
      uptime: process.uptime()
    }
  };

  try {
    // Check database connection
    const { error: dbError } = await supabase.from('shops').select('id').limit(1);
    checks.checks.database = dbError ? 'unhealthy' : 'healthy';

    // Check Redis connection
    await redis.ping();
    checks.checks.redis = 'healthy';
  } catch (error) {
    checks.status = 'unhealthy';
    checks.checks.redis = 'unhealthy';
  }

  const statusCode = checks.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(checks);
});

router.get('/ready', async (req: Request, res: Response) => {
  // Readiness probe - check if app is ready to receive traffic
  try {
    await supabase.from('shops').select('id').limit(1);
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

export default router;
```

### Prometheus Metrics
```typescript
// src/middleware/metrics.middleware.ts
import promClient from 'prom-client';

// Create metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const activeConversations = new promClient.Gauge({
  name: 'active_conversations_total',
  help: 'Number of active conversations'
});

// Middleware to collect metrics
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const labels = {
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode.toString()
    };
    
    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);
  });
  
  next();
};

// Metrics endpoint
export const metricsHandler = async (req: Request, res: Response) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
};
```

## Infrastructure as Code (Terraform)

### main.tf
```hcl
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# GKE Cluster
resource "google_container_cluster" "naay_cluster" {
  name               = "naay-agent-cluster"
  location           = var.region
  initial_node_count = 1

  node_config {
    machine_type = "e2-medium"
    disk_size_gb = 30
    
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]
  }

  # Enable autoscaling
  cluster_autoscaling {
    enabled = true
    resource_limits {
      resource_type = "cpu"
      minimum       = 1
      maximum       = 10
    }
    resource_limits {
      resource_type = "memory"
      minimum       = 2
      maximum       = 64
    }
  }
}

# Redis instance
resource "google_redis_instance" "naay_redis" {
  name           = "naay-redis"
  memory_size_gb = 1
  region         = var.region
}

# Cloud SQL instance (optional backup)
resource "google_sql_database_instance" "naay_postgres" {
  name             = "naay-postgres"
  database_version = "POSTGRES_15"
  region          = var.region

  settings {
    tier = "db-f1-micro"
    
    backup_configuration {
      enabled = true
    }
  }
}

# Load balancer
resource "google_compute_global_address" "naay_lb_ip" {
  name = "naay-lb-ip"
}

variables {
  project_id = "your-gcp-project-id"
  region     = "us-central1"
}
```

Esta configuración de deployment te proporciona una base sólida para producción con:

1. **Containerización completa** con Docker multi-stage builds
2. **Orquestación con Kubernetes** incluyendo health checks y scaling
3. **CI/CD automatizado** con testing y security scanning
4. **Monitoreo y observabilidad** con Prometheus y health endpoints
5. **Infrastructure as Code** con Terraform

Los archivos están disponibles en:
- `/Users/ignacioortiz/Documents/DevProjects/naay-agent/database-schema.sql` - Schema de base de datos
- `/Users/ignacioortiz/Documents/DevProjects/naay-agent/deployment-config.md` - Configuración de deployment

¿Te gustaría que agregue configuraciones específicas para algún proveedor de cloud en particular o que profundice en algún aspecto del deployment?