import { Router, Request, Response, NextFunction } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { logger } from '@/utils/logger';

const router = Router();
const supabaseService = new SupabaseService();

/**
 * GET /api/shopify/embedded/analytics
 * Get analytics for a shop in embedded Shopify context
 * This endpoint is designed to work without traditional auth,
 * relying on the fact that the shop parameter must match a valid store
 */
router.get(
  '/analytics',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = req.query.shop as string;

      if (!shopDomain) {
        return res.status(400).json({
          success: false,
          error: 'Shop domain is required',
        });
      }

      // Normalize shop domain
      let normalizedShop = shopDomain.toLowerCase().trim();
      if (!normalizedShop.includes('.myshopify.com')) {
        normalizedShop = `${normalizedShop}.myshopify.com`;
      }

      logger.info(`Embedded analytics request for: ${normalizedShop}`);

      // Verify the shop exists in our system (security check)
      const { data: store, error: storeError } = await (
        supabaseService as any
      ).serviceClient
        .from('stores')
        .select('shop_domain, installed_at, updated_at, widget_enabled')
        .eq('shop_domain', normalizedShop)
        .single();

      if (storeError || !store) {
        // Try client_stores as fallback
        const { data: clientStore } = await (
          supabaseService as any
        ).serviceClient
          .from('client_stores')
          .select(
            'shop_domain, created_at, last_sync_at, widget_enabled, status, products_synced'
          )
          .eq('shop_domain', normalizedShop)
          .single();

        if (!clientStore) {
          return res.status(404).json({
            success: false,
            error: 'Store not found',
          });
        }

        // Use client_store data
        const storeData = {
          shop_domain: clientStore.shop_domain,
          status: clientStore.status,
          widget_enabled: clientStore.widget_enabled,
          products_synced: clientStore.products_synced || 0,
          last_sync_at: clientStore.last_sync_at,
          created_at: clientStore.created_at,
        };

        // Get analytics from chat_messages
        const analytics = await getAnalyticsForShop(normalizedShop);

        return res.json({
          success: true,
          data: {
            store: storeData,
            analytics,
          },
        });
      }

      // Get product count
      const { count: productCount } = await (
        supabaseService as any
      ).serviceClient
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('shop_domain', normalizedShop);

      const storeData = {
        shop_domain: store.shop_domain,
        status: 'active',
        widget_enabled: store.widget_enabled,
        products_synced: productCount || 0,
        last_sync_at: store.updated_at,
        created_at: store.installed_at,
      };

      // Get analytics
      const analytics = await getAnalyticsForShop(normalizedShop);

      return res.json({
        success: true,
        data: {
          store: storeData,
          analytics,
        },
      });
    } catch (error) {
      logger.error('Embedded analytics error:', error);
      next(error);
    }
  }
);

/**
 * Helper function to get analytics for a shop
 */
async function getAnalyticsForShop(shopDomain: string) {
  // Get unique sessions (conversations)
  const { data: sessionsData } = await (supabaseService as any).serviceClient
    .from('chat_messages')
    .select('session_id')
    .eq('shop_domain', shopDomain);

  const uniqueSessions = new Set(
    sessionsData?.map((m: any) => m.session_id) || []
  );
  const conversationCount = uniqueSessions.size;

  // Get total messages
  const { count: messageCount } = await (supabaseService as any).serviceClient
    .from('chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('shop_domain', shopDomain);

  // Get products count
  const { count: productCount } = await (supabaseService as any).serviceClient
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('shop_domain', shopDomain);

  // Get recommendations count
  const { count: recommendationCount } = await (
    supabaseService as any
  ).serviceClient
    .from('simple_recommendations')
    .select('*', { count: 'exact', head: true })
    .eq('shop_domain', shopDomain);

  // Get conversions count
  const { count: conversionCount } = await (
    supabaseService as any
  ).serviceClient
    .from('simple_conversions')
    .select('*', { count: 'exact', head: true })
    .eq('shop_domain', shopDomain);

  // Get store dates
  const { data: storeInfo } = await (supabaseService as any).serviceClient
    .from('stores')
    .select('installed_at, updated_at')
    .eq('shop_domain', shopDomain)
    .single();

  return {
    conversations: conversationCount,
    messages: messageCount || 0,
    products: productCount || 0,
    recommendations: recommendationCount || 0,
    conversions: conversionCount || 0,
    lastSync: storeInfo?.updated_at || null,
    storeCreated: storeInfo?.installed_at || null,
  };
}

export default router;
