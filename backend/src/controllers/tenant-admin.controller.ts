import { Router, Request, Response, NextFunction } from 'express';
import { tenantService } from '@/services/tenant.service';
import { SupabaseService } from '@/services/supabase.service';
import { logger } from '@/utils/logger';
import {
  AppError,
  TenantPlan,
  TenantStatus,
  TENANT_PLAN_LIMITS,
} from '@/types';

const router = Router();
const supabaseService = new SupabaseService();

/**
 * GET /api/admin/tenants/stats
 * Get dashboard statistics
 */
router.get(
  '/stats',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Fetching tenant dashboard stats');

      // Get all tenants for stats calculation
      const { tenants, total } = await tenantService.getAllTenants();

      // Calculate stats
      const stats = {
        totalTenants: total,
        activeTenants: tenants.filter(t => t.status === 'active').length,
        trialTenants: tenants.filter(t => t.status === 'trial').length,
        totalMessages: tenants.reduce(
          (sum, t) => sum + t.monthly_messages_used,
          0
        ),
        totalProducts: 0, // Will calculate from products table
      };

      // Get total products count
      try {
        const { count } = await (supabaseService as any).serviceClient
          .from('products')
          .select('*', { count: 'exact', head: true });
        stats.totalProducts = count || 0;
      } catch (err) {
        logger.warn('Failed to get products count:', err);
      }

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error fetching tenant stats:', error);
      next(error);
    }
  }
);

/**
 * GET /api/admin/tenants
 * List all tenants with pagination and filters
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '10', status, plan } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    logger.info('Fetching tenants list', {
      page: pageNum,
      limit: limitNum,
      status,
      plan,
    });

    const result = await tenantService.getAllTenants({
      status: status as TenantStatus | undefined,
      plan: plan as TenantPlan | undefined,
      limit: limitNum,
      offset: offset,
    });

    res.json({
      success: true,
      data: {
        tenants: result.tenants,
        total: result.total,
      },
    });
  } catch (error) {
    logger.error('Error fetching tenants:', error);
    next(error);
  }
});

/**
 * GET /api/admin/tenants/:shopDomain
 * Get a specific tenant by shop domain
 */
router.get(
  '/:shopDomain',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shopDomain } = req.params;

      logger.info('Fetching tenant details', { shopDomain });

      const tenant = await tenantService.getTenant(shopDomain);

      if (!tenant) {
        throw new AppError('Tenant not found', 404);
      }

      res.json({
        success: true,
        data: tenant,
      });
    } catch (error) {
      logger.error('Error fetching tenant:', error);
      next(error);
    }
  }
);

/**
 * POST /api/admin/tenants
 * Create a new tenant (and store if needed)
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop_domain, access_token, shop_name, shop_email, plan } = req.body;

    if (!shop_domain) {
      throw new AppError('shop_domain is required', 400);
    }

    if (!access_token) {
      throw new AppError('access_token is required', 400);
    }

    logger.info('Creating new tenant', { shop_domain, plan });

    // Check if tenant already exists
    const existingTenant = await tenantService.getTenant(shop_domain);
    if (existingTenant) {
      throw new AppError('Tenant already exists for this shop', 409);
    }

    // Create or update store
    let store = await supabaseService.getStore(shop_domain);
    if (!store) {
      store = await supabaseService.createStore({
        shop_domain,
        access_token,
        scopes:
          'read_products,write_products,read_orders,read_customers,write_draft_orders',
        installed_at: new Date(),
        updated_at: new Date(),
        widget_enabled: true,
      });
      logger.info('Store created for new tenant', { shop_domain });
    }

    // Create tenant
    const tenant = await tenantService.createTenant(shop_domain, {
      shopName: shop_name,
      shopEmail: shop_email,
      plan: plan as TenantPlan,
    });

    if (!tenant) {
      throw new AppError('Failed to create tenant', 500);
    }

    // Create default app settings
    try {
      const { error: settingsError } = await (
        supabaseService as any
      ).serviceClient
        .from('app_settings')
        .insert({
          shop_domain,
          chat_enabled: true,
          welcome_message:
            '¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte?',
          chat_position: 'bottom-right',
          chat_color: '#008060',
          auto_open_chat: false,
          show_agent_avatar: true,
          enable_product_recommendations: true,
          enable_order_tracking: true,
          enable_analytics: true,
          created_at: new Date(),
          updated_at: new Date(),
        });

      if (settingsError && settingsError.code !== '23505') {
        logger.warn('Failed to create app settings:', settingsError);
      }
    } catch (err) {
      logger.warn('Error creating app settings:', err);
    }

    res.status(201).json({
      success: true,
      message: 'Tenant created successfully',
      data: tenant,
    });
  } catch (error) {
    logger.error('Error creating tenant:', error);
    next(error);
  }
});

/**
 * PUT /api/admin/tenants/:shopDomain
 * Update a tenant
 */
router.put(
  '/:shopDomain',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shopDomain } = req.params;
      const { plan, shop_name, shop_email } = req.body;

      logger.info('Updating tenant', { shopDomain, plan, shop_name });

      // Check if tenant exists
      const existingTenant = await tenantService.getTenant(shopDomain);
      if (!existingTenant) {
        throw new AppError('Tenant not found', 404);
      }

      let updatedTenant = existingTenant;

      // Update plan if changed
      if (plan && plan !== existingTenant.plan) {
        const result = await tenantService.updatePlan(
          shopDomain,
          plan as TenantPlan
        );
        if (result) {
          updatedTenant = result;
        }
      }

      // Update shop_name and shop_email if provided
      if (shop_name !== undefined || shop_email !== undefined) {
        const updateData: any = {};
        if (shop_name !== undefined) updateData.shop_name = shop_name;
        if (shop_email !== undefined) updateData.shop_email = shop_email;
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await (supabaseService as any).serviceClient
          .from('tenants')
          .update(updateData)
          .eq('shop_domain', shopDomain)
          .select()
          .single();

        if (error) {
          logger.error('Error updating tenant info:', error);
          throw new AppError('Failed to update tenant', 500);
        }

        // Refresh tenant data
        updatedTenant =
          (await tenantService.getTenant(shopDomain)) || updatedTenant;
      }

      res.json({
        success: true,
        message: 'Tenant updated successfully',
        data: updatedTenant,
      });
    } catch (error) {
      logger.error('Error updating tenant:', error);
      next(error);
    }
  }
);

/**
 * PUT /api/admin/tenants/:shopDomain/status
 * Update tenant status (activate, suspend, cancel)
 */
router.put(
  '/:shopDomain/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shopDomain } = req.params;
      const { status } = req.body;

      if (!status) {
        throw new AppError('status is required', 400);
      }

      const validStatuses: TenantStatus[] = [
        'active',
        'suspended',
        'cancelled',
        'trial',
      ];
      if (!validStatuses.includes(status)) {
        throw new AppError(
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          400
        );
      }

      logger.info('Updating tenant status', { shopDomain, status });

      // Check if tenant exists
      const existingTenant = await tenantService.getTenant(shopDomain);
      if (!existingTenant) {
        throw new AppError('Tenant not found', 404);
      }

      const success = await tenantService.updateStatus(
        shopDomain,
        status as TenantStatus
      );

      if (!success) {
        throw new AppError('Failed to update tenant status', 500);
      }

      // Get updated tenant
      const updatedTenant = await tenantService.getTenant(shopDomain);

      res.json({
        success: true,
        message: `Tenant status updated to ${status}`,
        data: updatedTenant,
      });
    } catch (error) {
      logger.error('Error updating tenant status:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/admin/tenants/:shopDomain
 * Delete a tenant (soft delete - marks as cancelled)
 */
router.delete(
  '/:shopDomain',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shopDomain } = req.params;
      const { hard = 'false' } = req.query;

      logger.info('Deleting tenant', { shopDomain, hard });

      // Check if tenant exists
      const existingTenant = await tenantService.getTenant(shopDomain);
      if (!existingTenant) {
        throw new AppError('Tenant not found', 404);
      }

      if (hard === 'true') {
        // Hard delete - remove from database
        const { error } = await (supabaseService as any).serviceClient
          .from('tenants')
          .delete()
          .eq('shop_domain', shopDomain);

        if (error) {
          logger.error('Error hard deleting tenant:', error);
          throw new AppError('Failed to delete tenant', 500);
        }

        logger.info('Tenant hard deleted', { shopDomain });
      } else {
        // Soft delete - mark as cancelled
        const success = await tenantService.updateStatus(
          shopDomain,
          'cancelled'
        );
        if (!success) {
          throw new AppError('Failed to cancel tenant', 500);
        }

        logger.info('Tenant soft deleted (cancelled)', { shopDomain });
      }

      res.json({
        success: true,
        message:
          hard === 'true' ? 'Tenant deleted permanently' : 'Tenant cancelled',
      });
    } catch (error) {
      logger.error('Error deleting tenant:', error);
      next(error);
    }
  }
);

/**
 * GET /api/admin/tenants/:shopDomain/usage
 * Get usage details for a tenant
 */
router.get(
  '/:shopDomain/usage',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shopDomain } = req.params;

      logger.info('Fetching tenant usage', { shopDomain });

      const usage = await tenantService.getUsageInfo(shopDomain);

      if (!usage) {
        throw new AppError('Tenant not found', 404);
      }

      res.json({
        success: true,
        data: usage,
      });
    } catch (error) {
      logger.error('Error fetching tenant usage:', error);
      next(error);
    }
  }
);

/**
 * POST /api/admin/tenants/:shopDomain/reset-usage
 * Reset monthly usage for a tenant
 */
router.post(
  '/:shopDomain/reset-usage',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shopDomain } = req.params;

      logger.info('Resetting tenant usage', { shopDomain });

      // Check if tenant exists
      const existingTenant = await tenantService.getTenant(shopDomain);
      if (!existingTenant) {
        throw new AppError('Tenant not found', 404);
      }

      // Reset usage to 0
      const { error } = await (supabaseService as any).serviceClient
        .from('tenants')
        .update({
          monthly_messages_used: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('shop_domain', shopDomain);

      if (error) {
        logger.error('Error resetting tenant usage:', error);
        throw new AppError('Failed to reset usage', 500);
      }

      res.json({
        success: true,
        message: 'Monthly usage reset successfully',
      });
    } catch (error) {
      logger.error('Error resetting tenant usage:', error);
      next(error);
    }
  }
);

/**
 * GET /api/admin/tenants/plans/info
 * Get available plans and their limits
 */
router.get(
  '/plans/info',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: TENANT_PLAN_LIMITS,
      });
    } catch (error) {
      logger.error('Error fetching plan info:', error);
      next(error);
    }
  }
);

export default router;
