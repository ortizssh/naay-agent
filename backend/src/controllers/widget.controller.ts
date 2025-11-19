import { Router, Request, Response, NextFunction } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';
import { validateAuth } from '@/middleware/shopify-auth.middleware';

const router = Router();
const supabaseService = new SupabaseService();

// Get widget status for a shop
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop } = req.query;

    if (!shop || typeof shop !== 'string') {
      throw new AppError('Shop parameter is required', 400);
    }

    logger.info(`Getting widget status for shop: ${shop}`);

    // Get store from database
    const store = await supabaseService.getStore(shop);
    
    if (!store) {
      throw new AppError('Store not found', 404);
    }

    // Widget is enabled by default, or check if we have a specific setting
    const widgetEnabled = store.widget_enabled ?? true;

    res.json({
      success: true,
      data: {
        enabled: widgetEnabled,
        shop: shop,
        last_updated: store.updated_at,
      },
    });
  } catch (error) {
    logger.error('Error getting widget status:', error);
    next(error);
  }
});

// Toggle widget status
router.post('/toggle', validateAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { enabled, shop } = req.body;
    const authenticatedShop = (req as any).shop;

    // Ensure the shop matches the authenticated shop
    if (shop !== authenticatedShop) {
      throw new AppError('Shop mismatch', 403);
    }

    if (typeof enabled !== 'boolean') {
      throw new AppError('Enabled parameter must be a boolean', 400);
    }

    logger.info(`Toggling widget for shop ${shop}: ${enabled ? 'enabling' : 'disabling'}`);

    // Update store widget setting
    const updatedStore = await supabaseService.updateStoreWidget(shop, enabled);

    if (!updatedStore) {
      throw new AppError('Failed to update widget setting', 500);
    }

    logger.info(`Widget ${enabled ? 'enabled' : 'disabled'} for shop: ${shop}`);

    res.json({
      success: true,
      message: `Widget ${enabled ? 'enabled' : 'disabled'} successfully`,
      data: {
        enabled: enabled,
        shop: shop,
        updated_at: updatedStore.updated_at,
      },
    });
  } catch (error) {
    logger.error('Error toggling widget:', error);
    next(error);
  }
});

// Get widget configuration for embedding in storefront
router.get('/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop } = req.query;

    if (!shop || typeof shop !== 'string') {
      throw new AppError('Shop parameter is required', 400);
    }

    logger.info(`Getting widget config for shop: ${shop}`);

    // Get store from database
    const store = await supabaseService.getStore(shop);
    
    if (!store) {
      throw new AppError('Store not found', 404);
    }

    // Only return config if widget is enabled
    const widgetEnabled = store.widget_enabled ?? true;

    if (!widgetEnabled) {
      res.json({
        success: true,
        enabled: false,
        message: 'Widget is disabled',
      });
      return;
    }

    res.json({
      success: true,
      enabled: true,
      data: {
        shop: shop,
        apiUrl: process.env.SHOPIFY_APP_URL || 'https://naay-agent-app1763504937.azurewebsites.net',
        theme: {
          position: 'bottom-right',
          primaryColor: '#5c6ac4',
          backgroundColor: '#ffffff',
          textColor: '#333333',
        },
        messages: {
          welcome: '¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte?',
          placeholder: 'Escribe tu mensaje...',
          sendButton: 'Enviar',
        },
      },
    });
  } catch (error) {
    logger.error('Error getting widget config:', error);
    next(error);
  }
});

export default router;