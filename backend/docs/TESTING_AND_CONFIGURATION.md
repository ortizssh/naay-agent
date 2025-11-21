# Testing and Configuration Guide

## Environment Setup

### Required Environment Variables

Create a `.env` file in your project root:

```bash
# Shopify Configuration
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
SHOPIFY_SCOPES=read_products,write_carts,read_customers,read_inventory
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret
SHOPIFY_APP_URL=https://your-backend.azurewebsites.net

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# Server Configuration
PORT=3000
NODE_ENV=development
JWT_SECRET=your_jwt_secret

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=false

# Logging
LOG_LEVEL=info
```

### Database Setup

Ensure your Supabase database has the required tables:

```sql
-- Stores table
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_domain TEXT UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    scopes TEXT NOT NULL,
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    widget_enabled BOOLEAN DEFAULT true
);

-- Chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_domain TEXT NOT NULL,
    customer_id TEXT,
    cart_id TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned'))
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product embeddings table (for semantic search)
CREATE TABLE IF NOT EXISTS product_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL,
    variant_id TEXT,
    shop_domain TEXT NOT NULL,
    embedding VECTOR(1536), -- For OpenAI embeddings
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_domain TEXT NOT NULL,
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stores_shop_domain ON stores(shop_domain);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_shop_domain ON chat_sessions(shop_domain);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_product_embeddings_shop_domain ON product_embeddings(shop_domain);
CREATE INDEX IF NOT EXISTS idx_analytics_events_shop_domain ON analytics_events(shop_domain);
```

### Shopify App Configuration

1. **Create Shopify App**: Go to your Shopify Partner dashboard and create a new app
2. **Configure OAuth**: Set your redirect URL to `https://your-backend.azurewebsites.net/api/auth/callback`
3. **Set Webhooks**: Configure webhook endpoints for product updates
4. **Request Permissions**: Ensure your app requests the required scopes

## Testing Framework

### Unit Tests

```javascript
// tests/services/shopify.service.test.js
import { ShopifyService } from '../../src/services/shopify.service.js';

describe('ShopifyService', () => {
    let shopifyService;
    const mockShop = 'test-store.myshopify.com';
    const mockAccessToken = 'test-access-token';
    
    beforeEach(() => {
        shopifyService = new ShopifyService();
    });
    
    describe('searchProducts', () => {
        it('should search products with basic query', async () => {
            const filters = { query: 'test product', limit: 5 };
            
            // Mock the Shopify API response
            const mockProducts = [
                {
                    id: 'gid://shopify/Product/123',
                    title: 'Test Product',
                    description: 'A test product',
                    variants: [
                        {
                            id: 'gid://shopify/ProductVariant/456',
                            price: '29.99',
                            inventory_quantity: 10
                        }
                    ]
                }
            ];
            
            // Test the search functionality
            const results = await shopifyService.searchProducts(
                mockShop,
                mockAccessToken,
                filters
            );
            
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
        });
        
        it('should handle price range filters', async () => {
            const filters = {
                query: 'shoes',
                priceRange: { min: 50, max: 200 },
                limit: 10
            };
            
            const results = await shopifyService.searchProducts(
                mockShop,
                mockAccessToken,
                filters
            );
            
            expect(results).toBeDefined();
        });
    });
    
    describe('cart operations', () => {
        it('should create a new cart', async () => {
            const cart = await shopifyService.createCart(
                mockShop,
                mockAccessToken
            );
            
            expect(cart).toBeDefined();
            expect(cart.id).toBeDefined();
        });
        
        it('should add items to cart', async () => {
            const cartId = 'gid://shopify/Cart/test-cart-id';
            const lines = [
                {
                    merchandiseId: 'gid://shopify/ProductVariant/456',
                    quantity: 1
                }
            ];
            
            const updatedCart = await shopifyService.addToCart(
                mockShop,
                mockAccessToken,
                cartId,
                lines
            );
            
            expect(updatedCart).toBeDefined();
            expect(updatedCart.lines.length).toBeGreaterThan(0);
        });
    });
});
```

### Integration Tests

```javascript
// tests/controllers/chat.controller.test.js
import request from 'supertest';
import app from '../../src/app.js';

describe('Chat Controller', () => {
    describe('POST /api/chat/message', () => {
        it('should handle product search queries', async () => {
            const response = await request(app)
                .post('/api/chat/message')
                .set('X-Shop-Domain', 'test-store.myshopify.com')
                .send({
                    message: 'Find red shoes under $100',
                    session_id: 'test-session-123'
                });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.messages).toBeDefined();
            expect(response.body.data.metadata.intent).toBe('search_products');
        });
        
        it('should handle add to cart requests', async () => {
            const response = await request(app)
                .post('/api/chat/message')
                .set('X-Shop-Domain', 'test-store.myshopify.com')
                .send({
                    message: 'Add Nike shoes to my cart',
                    session_id: 'test-session-123',
                    cart_id: null
                });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.metadata.intent).toBe('add_to_cart');
        });
        
        it('should handle cart viewing requests', async () => {
            const response = await request(app)
                .post('/api/chat/message')
                .set('X-Shop-Domain', 'test-store.myshopify.com')
                .send({
                    message: 'Show me my cart',
                    session_id: 'test-session-123',
                    cart_id: 'gid://shopify/Cart/test-cart'
                });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.metadata.intent).toBe('view_cart');
        });
        
        it('should handle product recommendations', async () => {
            const response = await request(app)
                .post('/api/chat/message')
                .set('X-Shop-Domain', 'test-store.myshopify.com')
                .send({
                    message: 'Show me recommendations',
                    session_id: 'test-session-123'
                });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.metadata.intent).toBe('product_recommendation');
        });
    });
    
    describe('POST /api/chat/session', () => {
        it('should create a new chat session', async () => {
            const response = await request(app)
                .post('/api/chat/session')
                .set('X-Shop-Domain', 'test-store.myshopify.com')
                .send({
                    customer_id: 'test-customer-123'
                });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.session_id).toBeDefined();
        });
    });
});
```

### End-to-End Tests

```javascript
// tests/e2e/shopping-flow.test.js
import { test, expect } from '@playwright/test';

test.describe('AI Shopping Assistant E2E', () => {
    test('complete shopping flow', async ({ page }) => {
        // Navigate to the test store
        await page.goto('https://test-store.myshopify.com');
        
        // Open chat widget
        await page.click('#naay-chat-widget-trigger');
        
        // Search for products
        await page.fill('#chat-input', 'Find black sneakers under $150');
        await page.click('#send-button');
        
        // Wait for AI response
        await page.waitForSelector('.message.assistant');
        
        // Verify products are displayed
        const products = await page.locator('.product-card');
        await expect(products).toHaveCount(3, { timeout: 10000 });
        
        // Add first product to cart
        await page.click('.product-card:first-child .add-to-cart-btn');
        
        // Wait for cart confirmation
        await page.waitForSelector('.cart-confirmation');
        
        // View cart
        await page.fill('#chat-input', 'Show me my cart');
        await page.click('#send-button');
        
        // Verify cart contents
        await expect(page.locator('.cart-summary')).toBeVisible();
        await expect(page.locator('.cart-total')).toContainText('$');
        
        // Proceed to checkout
        await page.click('.checkout-button');
        
        // Verify redirect to Shopify checkout
        await expect(page).toHaveURL(/.*checkout.*/);
    });
    
    test('product recommendations flow', async ({ page }) => {
        await page.goto('https://test-store.myshopify.com');
        await page.click('#naay-chat-widget-trigger');
        
        // Add a product to cart first
        await page.fill('#chat-input', 'Add iPhone 14 to cart');
        await page.click('#send-button');
        await page.waitForSelector('.cart-confirmation');
        
        // Request recommendations
        await page.fill('#chat-input', 'Show me recommendations');
        await page.click('#send-button');
        
        // Verify recommendations are displayed
        await page.waitForSelector('.recommendations');
        const recommendations = await page.locator('.recommendation-item');
        await expect(recommendations).toHaveCountGreaterThan(2);
        
        // Verify each recommendation has a score and reason
        const firstRec = recommendations.first();
        await expect(firstRec.locator('.score')).toBeVisible();
        await expect(firstRec.locator('.reason')).toBeVisible();
    });
});
```

### Manual Testing Checklist

#### Product Search Testing

- [ ] Basic text search: "Find red dresses"
- [ ] Search with price filter: "Show me shoes under $100"
- [ ] Search with brand filter: "Find Nike products"
- [ ] Search with category: "Show me electronics"
- [ ] Empty search results handling
- [ ] Typos and misspellings handling
- [ ] Search result formatting and display

#### Cart Management Testing

- [ ] Create new cart when none exists
- [ ] Add product by name: "Add iPhone 14 to cart"
- [ ] Add product by number: "Add product 1 to cart"
- [ ] Add multiple quantities: "Add 3 red shirts to cart"
- [ ] View cart contents: "Show me my cart"
- [ ] Remove items: "Remove item 1 from cart"
- [ ] Update quantities: "Change item 1 quantity to 3"
- [ ] Cart total calculations accuracy
- [ ] Checkout URL generation

#### Recommendations Testing

- [ ] General recommendations: "Show me recommendations"
- [ ] Cart-based recommendations with items in cart
- [ ] Product-based recommendations: "What goes with iPhone?"
- [ ] Recommendation scoring and reasons
- [ ] Fallback to popular products when no context
- [ ] Add recommended products to cart

#### Error Handling Testing

- [ ] Invalid product names
- [ ] Out of stock products
- [ ] Invalid cart operations
- [ ] Network timeout handling
- [ ] API rate limit handling
- [ ] Malformed requests

### Performance Testing

```javascript
// tests/performance/load.test.js
import { check } from 'k6';
import http from 'k6/http';

export let options = {
    stages: [
        { duration: '30s', target: 10 },  // Ramp up
        { duration: '1m', target: 50 },   // Stay at 50 users
        { duration: '30s', target: 0 },   // Ramp down
    ],
};

export default function() {
    const payload = JSON.stringify({
        message: 'Find black sneakers',
        session_id: `perf_test_${__VU}_${__ITER}`,
        shop: 'test-store.myshopify.com'
    });
    
    const params = {
        headers: {
            'Content-Type': 'application/json',
            'X-Shop-Domain': 'test-store.myshopify.com'
        }
    };
    
    const response = http.post(
        'https://your-backend.azurewebsites.net/api/chat/message',
        payload,
        params
    );
    
    check(response, {
        'status is 200': (r) => r.status === 200,
        'response time < 2s': (r) => r.timings.duration < 2000,
        'has success flag': (r) => JSON.parse(r.body).success === true
    });
}
```

### Monitoring and Alerts

#### Health Check Endpoints

Test these endpoints regularly:

- `GET /api/chat/health` - Overall system health
- `GET /api/health` - Database connectivity
- `GET /api/health/shopify` - Shopify API connectivity

#### Key Metrics to Monitor

1. **Response Times**
   - Chat message processing: < 2s
   - Product search: < 1s
   - Cart operations: < 1s

2. **Success Rates**
   - Intent recognition accuracy: > 90%
   - Successful product searches: > 95%
   - Successful cart operations: > 98%

3. **Error Rates**
   - API errors: < 1%
   - Timeout errors: < 0.5%
   - Invalid requests: < 5%

#### Alerts Configuration

Set up alerts for:
- Response time > 5 seconds
- Error rate > 5%
- Failed health checks
- High memory usage
- Database connection failures

### Deployment Validation

#### Pre-deployment Checklist

- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] Shopify app permissions verified
- [ ] SSL certificates valid
- [ ] CORS settings configured
- [ ] Rate limiting configured
- [ ] Logging configured
- [ ] Health checks passing

#### Post-deployment Verification

- [ ] All API endpoints responding
- [ ] Chat functionality working
- [ ] Product search returning results
- [ ] Cart operations successful
- [ ] Database connectivity confirmed
- [ ] External API connections working
- [ ] Monitoring alerts configured
- [ ] Performance within acceptable ranges

### Troubleshooting Guide

#### Common Issues

1. **"Store not found" errors**
   - Verify shop domain format
   - Check database connection
   - Confirm store exists in database

2. **Product search returns no results**
   - Check Shopify API permissions
   - Verify product publication status
   - Test with different search terms

3. **Cart operations failing**
   - Verify Storefront API access token
   - Check product variant IDs
   - Confirm inventory availability

4. **AI responses are poor**
   - Check OpenAI API key and quota
   - Review intent analysis prompts
   - Verify training data quality

#### Debug Commands

```bash
# Check service health
curl https://your-backend.azurewebsites.net/api/health

# Test chat endpoint
curl -X POST https://your-backend.azurewebsites.net/api/chat/message \
  -H "Content-Type: application/json" \
  -H "X-Shop-Domain: test-store.myshopify.com" \
  -d '{"message": "hello", "session_id": "test"}'

# View logs
tail -f logs/app.log | grep ERROR
```

This testing framework ensures the AI Agent's Shopify integration is reliable, performant, and provides excellent customer experience.