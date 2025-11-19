# Modern Shopify Authentication Implementation

This document explains how to use the modernized Shopify authentication system with Session Tokens and App Bridge 3.0.

## Overview

The modern authentication system supports:
- **Session Tokens** for embedded app authentication (App Bridge 3.0)
- **OAuth flow** for initial app installation
- **Automatic token renewal** and validation
- **Proper security** with JWT verification
- **2024 Shopify standards** compliance

## Architecture

### Authentication Flow

1. **Initial Installation**: Traditional OAuth flow creates offline access token
2. **Embedded App Access**: Session tokens for all API requests
3. **Token Validation**: JWT verification on every request
4. **Automatic Renewal**: Handle token expiration gracefully

### Components

- `shopify-auth.middleware.ts` - Session token validation
- `modern-auth.controller.ts` - Authentication endpoints
- `modern-shopify.service.ts` - API service with automatic token handling
- `shopify-auth.ts` (frontend) - App Bridge integration

## Backend Implementation

### 1. Use Modern Authentication Middleware

Replace your old token verification with session token validation:

```typescript
import { validateSessionToken } from '@/middleware/shopify-auth.middleware';

// Apply to protected routes
router.get('/protected', validateSessionToken, (req, res) => {
  const { shop, userId } = req;
  // shop and userId are automatically available
});
```

### 2. Use Modern Shopify Service

The service automatically handles token retrieval:

```typescript
import { ModernShopifyService } from '@/services/modern-shopify.service';

const shopifyService = new ModernShopifyService();

// No need to pass access token - automatically retrieved
const products = await shopifyService.getAllProducts(shop);
```

### 3. Authentication Endpoints

Use the modern controller for authentication:

```typescript
import modernAuthController from '@/controllers/modern-auth.controller';

app.use('/api/auth', modernAuthController);
```

Available endpoints:
- `GET /api/auth/install` - Generate OAuth installation URL
- `GET /api/auth/callback` - Handle OAuth callback
- `GET /api/auth/session` - Verify session token and get session info
- `POST /api/auth/refresh` - Refresh authentication status
- `DELETE /api/auth/uninstall` - Handle app uninstallation
- `GET /api/auth/status` - Check authentication status
- `GET /api/auth/health` - Health check

## Frontend Implementation

### 1. Initialize App Bridge

```typescript
import { initializeAuthentication, useShopifyAuth } from '@/utils/shopify-auth';

// Initialize on app load
const result = await initializeAuthentication({
  apiKey: 'your-api-key',
  host: 'base64-encoded-host'
});
```

### 2. Use Authentication Hook

```typescript
function MyComponent() {
  const { 
    isAuthenticated, 
    isLoading, 
    shop, 
    authenticatedFetch 
  } = useShopifyAuth();

  // Use authenticatedFetch for API calls
  const handleApiCall = async () => {
    const response = await authenticatedFetch('/api/products');
    const data = await response.json();
  };
}
```

### 3. Make Authenticated API Calls

```typescript
import { createAuthenticatedFetch } from '@/utils/shopify-auth';

const authenticatedFetch = createAuthenticatedFetch();

// All requests automatically include session tokens
const response = await authenticatedFetch('/api/products', {
  method: 'POST',
  body: JSON.stringify(productData)
});
```

## Database Changes

### Required Migration

Run the migration to create the sessions table:

```sql
-- Run this SQL against your Supabase database
-- File: backend/migrations/create_shopify_sessions.sql
```

### Session Management

```typescript
import { SupabaseService } from '@/services/supabase.service';

const supabaseService = new SupabaseService();

// Store session after OAuth
await supabaseService.upsertSession({
  shop: 'mystore.myshopify.com',
  access_token: 'offline-token',
  scope: 'read_products,write_products',
  expires_at: new Date('2025-01-01'),
  session_id: 'unique-session-id',
  is_online: false
});

// Get offline session for API calls
const session = await supabaseService.getOfflineSession('mystore.myshopify.com');
```

## Configuration

### 1. Environment Variables

```env
SHOPIFY_API_KEY=your-api-key
SHOPIFY_API_SECRET=your-api-secret
SHOPIFY_APP_URL=https://your-app.ngrok.io
SHOPIFY_SCOPES=read_products,write_products,read_orders
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret
```

### 2. Shopify App Configuration

Update `shopify.app.toml`:

```toml
embedded = true
api_version = "2024-10"

[app.authentication]
enabled = true
```

## Security Considerations

### 1. JWT Verification

Session tokens are validated using:
- Signature verification with Shopify's secret
- Audience validation (app API key)
- Expiration checking
- Issuer validation (shop domain)

### 2. Token Storage

- **Offline tokens**: Stored encrypted in database
- **Session tokens**: Never stored, always fresh from App Bridge
- **Automatic cleanup**: Expired sessions removed

### 3. Error Handling

```typescript
try {
  const response = await authenticatedFetch('/api/data');
} catch (error) {
  if (error.message === 'Authentication failed') {
    // User will be redirected to re-authenticate
  }
}
```

## Migration Guide

### From Traditional OAuth

1. **Keep OAuth flow** for initial installation
2. **Add session token validation** to existing endpoints
3. **Update frontend** to use App Bridge session tokens
4. **Run database migration** for sessions table
5. **Update API calls** to use session tokens

### Example Migration

Before:
```typescript
// Old way
router.get('/products', verifyToken, async (req, res) => {
  const { shop } = req;
  const store = await getStore(shop);
  const products = await shopifyService.getProducts(shop, store.access_token);
});
```

After:
```typescript
// New way
router.get('/products', validateSessionToken, async (req, res) => {
  const { shop } = req;
  const products = await modernShopifyService.getAllProducts(shop);
});
```

## Testing

### 1. Test Authentication

```typescript
// Test session token validation
const token = 'session-token-from-app-bridge';
const response = await fetch('/api/auth/session', {
  headers: { Authorization: `Bearer ${token}` }
});
```

### 2. Test API Calls

```typescript
// Test authenticated API calls
const authenticatedFetch = createAuthenticatedFetch();
const response = await authenticatedFetch('/api/products');
```

## Troubleshooting

### Common Issues

1. **"Session token required"**
   - Ensure App Bridge is initialized
   - Check that `getSessionToken()` is working

2. **"Invalid session token signature"**
   - Verify your `SHOPIFY_API_SECRET` is correct
   - Check token isn't expired

3. **"Store not registered"**
   - Complete OAuth installation flow first
   - Check database for store record

4. **Frontend not getting tokens**
   - Verify App Bridge initialization
   - Check browser console for errors
   - Ensure correct API key and host

### Debug Mode

Enable debug logging:

```typescript
// Backend
logger.level = 'debug';

// Frontend
console.log('Session token:', await getAuthenticatedSessionToken());
```

## Best Practices

1. **Always use Session Tokens** for embedded app requests
2. **Keep OAuth flow** for initial installation only
3. **Handle token expiration** gracefully with automatic renewal
4. **Use offline tokens** for background jobs and webhooks
5. **Implement proper error handling** with user feedback
6. **Regular cleanup** of expired sessions
7. **Monitor authentication metrics** for debugging

## Performance

- Session tokens are cached temporarily to avoid repeated requests
- Database queries are optimized with proper indexes
- Automatic cleanup prevents session table growth
- Connection pooling for database efficiency

## Compliance

This implementation follows:
- Shopify's 2024 authentication standards
- App Bridge 3.0 best practices
- Security recommendations for embedded apps
- GDPR compliance for session management