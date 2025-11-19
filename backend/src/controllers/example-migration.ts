/**
 * Example: How to migrate existing endpoints to modern authentication
 * This file shows before/after examples for your reference
 */

import { Router, Request, Response, NextFunction } from 'express';
import { validateSessionToken } from '@/middleware/shopify-auth.middleware';
import { ModernShopifyService } from '@/services/modern-shopify.service';
import { SupabaseService } from '@/services/supabase.service';

const router = Router();
const modernShopifyService = new ModernShopifyService();
const supabaseService = new SupabaseService();

// =======================================
// BEFORE: Traditional OAuth + JWT tokens
// =======================================

/*
// Old authentication middleware
export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new AppError('Authorization token required', 401);
    
    const decoded = jwt.verify(token, config.server.jwtSecret) as any;
    (req as any).shop = decoded.shop;
    (req as any).storeId = decoded.sub;
    next();
  } catch (error) {
    // Handle error
  }
};

// Old endpoint implementation
router.get('/products/old-way', verifyToken, async (req: Request, res: Response) => {
  try {
    const shop = (req as any).shop;
    
    // Had to manually get store and access token
    const store = await supabaseService.getStore(shop);
    if (!store) throw new AppError('Store not found', 404);
    
    // Pass access token explicitly
    const products = await shopifyService.getAllProducts(shop, store.access_token);
    
    res.json({ success: true, data: products });
  } catch (error) {
    // Handle error
  }
});
*/

// =======================================
// AFTER: Modern Session Token authentication
// =======================================

/**
 * Modern endpoint with Session Token authentication
 * No need to manually handle access tokens
 */
router.get('/products', validateSessionToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = (req as any).shop;
    const userId = (req as any).userId;
    
    // Modern service automatically handles token retrieval
    const products = await modernShopifyService.getAllProducts(shop);
    
    res.json({
      success: true,
      data: {
        products,
        shop,
        requestedBy: userId
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get single product with modern authentication
 */
router.get('/products/:id', validateSessionToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = (req as any).shop;
    const { id } = req.params;
    
    // No access token needed - handled automatically
    const product = await modernShopifyService.getProduct(shop, id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Sync products endpoint with modern authentication
 */
router.post('/products/sync', validateSessionToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = (req as any).shop;
    
    // Trigger background sync job
    // Modern service handles authentication automatically
    const products = await modernShopifyService.getAllProducts(shop);
    
    // Save to database
    for (const product of products) {
      await supabaseService.saveProduct(shop, product);
    }
    
    res.json({
      success: true,
      data: {
        message: `Synced ${products.length} products`,
        shop,
        count: products.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get shop information with modern authentication
 */
router.get('/shop/info', validateSessionToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = (req as any).shop;
    
    // Get shop info using modern service
    const shopInfo = await modernShopifyService.getShopInfo(shop);
    
    res.json({
      success: true,
      data: shopInfo
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Example of an endpoint that still needs offline access
 * (for background jobs, webhooks, etc.)
 */
router.post('/products/background-sync', validateSessionToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = (req as any).shop;
    
    // For background jobs, you might still need the offline token
    const offlineSession = await supabaseService.getOfflineSession(shop);
    
    if (!offlineSession) {
      return res.status(401).json({
        success: false,
        error: 'Offline access required for background operations'
      });
    }
    
    // Use the offline token for background operations
    const products = await modernShopifyService.getAllProducts(shop, offlineSession.access_token);
    
    res.json({
      success: true,
      data: {
        message: 'Background sync initiated',
        productCount: products.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Example of handling authentication errors gracefully
 */
router.get('/products/with-error-handling', validateSessionToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = (req as any).shop;
    
    const products = await modernShopifyService.getAllProducts(shop);
    
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    // The validateSessionToken middleware handles most auth errors
    // but you can add additional handling here
    if (error.message.includes('access token')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        action: 'REDIRECT_TO_INSTALL'
      });
    }
    
    next(error);
  }
});

// =======================================
// Frontend Integration Examples
// =======================================

/*
// Frontend: Before (manual token management)
const response = await fetch('/api/products', {
  headers: {
    'Authorization': `Bearer ${manuallyManagedJWT}`,
    'Content-Type': 'application/json'
  }
});

// Frontend: After (automatic session token)
import { createAuthenticatedFetch } from '@/utils/shopify-auth';

const authenticatedFetch = createAuthenticatedFetch();
const response = await authenticatedFetch('/api/products');

// Or using the React hook
function ProductsComponent() {
  const { authenticatedFetch, isAuthenticated, shop } = useShopifyAuth();
  
  const loadProducts = async () => {
    if (!isAuthenticated) return;
    
    try {
      const response = await authenticatedFetch('/api/products');
      const data = await response.json();
      setProducts(data.data);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };
  
  useEffect(() => {
    loadProducts();
  }, [isAuthenticated]);
}
*/

// =======================================
// Webhook Handler (still uses offline tokens)
// =======================================

/**
 * Webhook handlers still use offline access tokens
 * since they're not user-initiated requests
 */
router.post('/webhooks/products/update', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = req.headers['x-shopify-shop-domain'] as string;
    const product = req.body;
    
    // For webhooks, we use the offline session
    const offlineSession = await supabaseService.getOfflineSession(shop);
    
    if (!offlineSession) {
      return res.status(401).json({
        success: false,
        error: 'No offline access available for webhook processing'
      });
    }
    
    // Update product in database
    await supabaseService.saveProduct(shop, product);
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;