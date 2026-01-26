import { SupabaseService } from './supabase.service';
import { cacheService } from './cache.service';
import { logger } from '@/utils/logger';
import {
  Tenant,
  TenantPlan,
  TenantStatus,
  TenantFeatures,
  TenantSettings,
  TenantUsageInfo,
  TenantError,
  TenantErrorCode,
  TENANT_PLAN_LIMITS,
} from '@/types';

const supabaseService = new SupabaseService();

export class TenantService {
  private static readonly CACHE_TTL = 300; // 5 minutes
  private static readonly CACHE_PREFIX = 'tenant:';

  /**
   * Get tenant by shop domain
   */
  async getTenant(shopDomain: string): Promise<Tenant | null> {
    try {
      // Check cache first
      const cacheKey = `${TenantService.CACHE_PREFIX}${shopDomain}`;
      const cached = await cacheService.get<Tenant>(cacheKey);
      if (cached) {
        return cached;
      }

      // Fetch from database
      const { data, error } = await (supabaseService as any).serviceClient
        .from('tenants')
        .select('*')
        .eq('shop_domain', shopDomain)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return null;
        }
        logger.error('Error fetching tenant:', error);
        return null;
      }

      const tenant = this.mapDbToTenant(data);

      // Cache the result
      await cacheService.set(cacheKey, tenant, { ttl: TenantService.CACHE_TTL });

      return tenant;
    } catch (error) {
      logger.error('Error in getTenant:', error);
      return null;
    }
  }

  /**
   * Create a new tenant (called automatically when store is created)
   */
  async createTenant(
    shopDomain: string,
    options?: {
      shopName?: string;
      shopEmail?: string;
      plan?: TenantPlan;
    }
  ): Promise<Tenant | null> {
    try {
      // Use 'free' plan limits for trial accounts
      const effectivePlan: TenantPlan = options?.plan || 'free';
      const planLimits = TENANT_PLAN_LIMITS[effectivePlan];

      const { data, error } = await (supabaseService as any).serviceClient
        .from('tenants')
        .insert({
          shop_domain: shopDomain,
          shop_name: options?.shopName || shopDomain,
          shop_email: options?.shopEmail,
          plan: effectivePlan,
          status: options?.plan ? 'active' : 'trial',
          trial_ends_at: options?.plan
            ? null
            : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
          monthly_messages_limit: planLimits.monthly_messages,
          products_limit: planLimits.products,
          features: planLimits.features,
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating tenant:', error);
        return null;
      }

      return this.mapDbToTenant(data);
    } catch (error) {
      logger.error('Error in createTenant:', error);
      return null;
    }
  }

  /**
   * Update tenant plan
   */
  async updatePlan(
    shopDomain: string,
    newPlan: TenantPlan
  ): Promise<Tenant | null> {
    try {
      const planLimits = TENANT_PLAN_LIMITS[newPlan];

      const { data, error } = await (supabaseService as any).serviceClient
        .from('tenants')
        .update({
          plan: newPlan,
          status: 'active',
          trial_ends_at: null,
          monthly_messages_limit: planLimits.monthly_messages,
          products_limit: planLimits.products,
          features: planLimits.features,
        })
        .eq('shop_domain', shopDomain)
        .select()
        .single();

      if (error) {
        logger.error('Error updating tenant plan:', error);
        return null;
      }

      // Invalidate cache
      await this.invalidateCache(shopDomain);

      return this.mapDbToTenant(data);
    } catch (error) {
      logger.error('Error in updatePlan:', error);
      return null;
    }
  }

  /**
   * Update tenant status
   */
  async updateStatus(
    shopDomain: string,
    status: TenantStatus
  ): Promise<boolean> {
    try {
      const { error } = await (supabaseService as any).serviceClient
        .from('tenants')
        .update({ status })
        .eq('shop_domain', shopDomain);

      if (error) {
        logger.error('Error updating tenant status:', error);
        return false;
      }

      await this.invalidateCache(shopDomain);
      return true;
    } catch (error) {
      logger.error('Error in updateStatus:', error);
      return false;
    }
  }

  /**
   * Update tenant settings
   */
  async updateSettings(
    shopDomain: string,
    settings: Partial<TenantSettings>
  ): Promise<Tenant | null> {
    try {
      const tenant = await this.getTenant(shopDomain);
      if (!tenant) return null;

      const newSettings = { ...tenant.settings, ...settings };

      const { data, error } = await (supabaseService as any).serviceClient
        .from('tenants')
        .update({ settings: newSettings })
        .eq('shop_domain', shopDomain)
        .select()
        .single();

      if (error) {
        logger.error('Error updating tenant settings:', error);
        return null;
      }

      await this.invalidateCache(shopDomain);
      return this.mapDbToTenant(data);
    } catch (error) {
      logger.error('Error in updateSettings:', error);
      return null;
    }
  }

  /**
   * Increment message usage
   */
  async incrementUsage(
    shopDomain: string,
    count: number = 1
  ): Promise<boolean> {
    try {
      const { data, error } = await (supabaseService as any).serviceClient.rpc(
        'increment_tenant_usage',
        {
          p_shop_domain: shopDomain,
          p_messages_count: count,
        }
      );

      if (error) {
        logger.error('Error incrementing tenant usage:', error);
        return false;
      }

      // Update cache if exists
      await this.invalidateCache(shopDomain);

      return data === true;
    } catch (error) {
      logger.error('Error in incrementUsage:', error);
      return false;
    }
  }

  /**
   * Get usage info for a tenant
   */
  async getUsageInfo(shopDomain: string): Promise<TenantUsageInfo | null> {
    try {
      const tenant = await this.getTenant(shopDomain);
      if (!tenant) return null;

      const limit = tenant.monthly_messages_limit;
      const used = tenant.monthly_messages_used;
      const isUnlimited = limit === -1;

      return {
        messages_used: used,
        messages_limit: limit,
        messages_remaining: isUnlimited ? -1 : Math.max(0, limit - used),
        usage_percentage: isUnlimited ? 0 : Math.round((used / limit) * 100),
        is_over_limit: !isUnlimited && used >= limit,
      };
    } catch (error) {
      logger.error('Error in getUsageInfo:', error);
      return null;
    }
  }

  /**
   * Check if tenant can use a feature
   */
  async canUseFeature(
    shopDomain: string,
    feature: keyof TenantFeatures
  ): Promise<boolean> {
    try {
      const tenant = await this.getTenant(shopDomain);
      if (!tenant) return false;

      return tenant.features[feature] === true;
    } catch (error) {
      logger.error('Error in canUseFeature:', error);
      return false;
    }
  }

  /**
   * Validate tenant can perform action (not suspended, within limits)
   */
  async validateTenantAccess(shopDomain: string): Promise<void> {
    const tenant = await this.getTenant(shopDomain);

    if (!tenant) {
      throw new TenantError(
        'Tenant not found',
        TenantErrorCode.TENANT_NOT_FOUND,
        shopDomain
      );
    }

    // Check status
    if (tenant.status === 'suspended') {
      throw new TenantError(
        'Account is suspended. Please contact support.',
        TenantErrorCode.TENANT_SUSPENDED,
        shopDomain
      );
    }

    if (tenant.status === 'cancelled') {
      throw new TenantError(
        'Account has been cancelled.',
        TenantErrorCode.TENANT_CANCELLED,
        shopDomain
      );
    }

    // Check trial expiration
    if (
      tenant.status === 'trial' &&
      tenant.trial_ends_at &&
      new Date() > tenant.trial_ends_at
    ) {
      throw new TenantError(
        'Trial period has expired. Please upgrade your plan.',
        TenantErrorCode.TENANT_SUSPENDED,
        shopDomain,
        { trialEndedAt: tenant.trial_ends_at }
      );
    }

    // Check message limit
    if (
      tenant.monthly_messages_limit !== -1 &&
      tenant.monthly_messages_used >= tenant.monthly_messages_limit
    ) {
      throw new TenantError(
        'Monthly message limit exceeded. Please upgrade your plan.',
        TenantErrorCode.USAGE_LIMIT_EXCEEDED,
        shopDomain,
        {
          used: tenant.monthly_messages_used,
          limit: tenant.monthly_messages_limit,
        }
      );
    }
  }

  /**
   * Get all tenants (for admin purposes)
   */
  async getAllTenants(options?: {
    status?: TenantStatus;
    plan?: TenantPlan;
    limit?: number;
    offset?: number;
  }): Promise<{ tenants: Tenant[]; total: number }> {
    try {
      let query = (supabaseService as any).serviceClient
        .from('tenants')
        .select('*', { count: 'exact' });

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      if (options?.plan) {
        query = query.eq('plan', options.plan);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(
          options.offset,
          options.offset + (options.limit || 10) - 1
        );
      }

      query = query.order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        logger.error('Error fetching all tenants:', error);
        return { tenants: [], total: 0 };
      }

      return {
        tenants: data.map((d: any) => this.mapDbToTenant(d)),
        total: count || 0,
      };
    } catch (error) {
      logger.error('Error in getAllTenants:', error);
      return { tenants: [], total: 0 };
    }
  }

  /**
   * Update Stripe info for tenant
   */
  async updateStripeInfo(
    shopDomain: string,
    stripeInfo: {
      stripe_customer_id?: string;
      stripe_subscription_id?: string;
      billing_email?: string;
    }
  ): Promise<boolean> {
    try {
      const { error } = await (supabaseService as any).serviceClient
        .from('tenants')
        .update(stripeInfo)
        .eq('shop_domain', shopDomain);

      if (error) {
        logger.error('Error updating Stripe info:', error);
        return false;
      }

      await this.invalidateCache(shopDomain);
      return true;
    } catch (error) {
      logger.error('Error in updateStripeInfo:', error);
      return false;
    }
  }

  /**
   * Record activity for tenant
   */
  async recordActivity(shopDomain: string): Promise<void> {
    try {
      await (supabaseService as any).serviceClient
        .from('tenants')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('shop_domain', shopDomain);
    } catch (error) {
      // Non-critical, just log
      logger.warn('Failed to record tenant activity:', error);
    }
  }

  // =====================================================
  // Private helpers
  // =====================================================

  private async invalidateCache(shopDomain: string): Promise<void> {
    const cacheKey = `${TenantService.CACHE_PREFIX}${shopDomain}`;
    await cacheService.del(cacheKey);
  }

  private mapDbToTenant(data: any): Tenant {
    return {
      id: data.id,
      shop_domain: data.shop_domain,
      shop_name: data.shop_name,
      shop_email: data.shop_email,
      plan: data.plan,
      status: data.status,
      trial_ends_at: data.trial_ends_at ? new Date(data.trial_ends_at) : undefined,
      monthly_messages_limit: data.monthly_messages_limit,
      monthly_messages_used: data.monthly_messages_used,
      products_limit: data.products_limit,
      billing_email: data.billing_email,
      stripe_customer_id: data.stripe_customer_id,
      stripe_subscription_id: data.stripe_subscription_id,
      features: data.features || TENANT_PLAN_LIMITS.free.features,
      settings: data.settings || {
        widget_position: 'bottom-right',
        widget_color: '#000000',
        welcome_message: '¡Hola! ¿En qué puedo ayudarte?',
        language: 'es',
      },
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
      last_activity_at: new Date(data.last_activity_at),
    };
  }
}

// Singleton export
export const tenantService = new TenantService();
