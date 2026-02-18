import { SupabaseService } from './supabase.service';
import { cacheService } from './cache.service';
import { planService } from './plan.service';
import { logger } from '@/utils/logger';
import {
  Tenant,
  TenantPlan,
  TenantStatus,
  TenantFeatures,
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
      await cacheService.set(cacheKey, tenant, {
        ttl: TenantService.CACHE_TTL,
      });

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
      const effectivePlan: TenantPlan = options?.plan || 'free';
      const planLimits = await planService.getPlanLimits(effectivePlan);

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
      const planLimits = await planService.getPlanLimits(newPlan);

      const { data, error } = await (supabaseService as any).serviceClient
        .from('tenants')
        .update({
          plan: newPlan,
          status: 'active',
          trial_ends_at: null,
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
   * Get real monthly message count from chat_messages table
   * Counts AI responses (role='assistant') for the current month
   */
  async getMonthlyMessageCount(shopDomain: string): Promise<number> {
    try {
      const cacheKey = `tenant:monthly_msgs:${shopDomain}`;
      const cached = await cacheService.get<number>(cacheKey);
      if (cached !== null && cached !== undefined) return cached;

      const now = new Date();
      const monthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      ).toISOString();

      const { count, error } = await (supabaseService as any).serviceClient
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('shop_domain', shopDomain)
        .eq('role', 'agent')
        .gte('timestamp', monthStart);

      const result = error ? 0 : count || 0;
      await cacheService.set(cacheKey, result, { ttl: 60 });
      return result;
    } catch (error) {
      logger.error('Error in getMonthlyMessageCount:', error);
      return 0;
    }
  }

  /**
   * Invalidate monthly message count cache (call after each new message)
   */
  async invalidateMessageCountCache(shopDomain: string): Promise<void> {
    await cacheService.del(`tenant:monthly_msgs:${shopDomain}`);
  }

  /**
   * Get monthly completed voice call count from voice_call_logs table
   * Counts calls with status='ended' for the current month
   */
  async getMonthlyVoiceCallCount(shopDomain: string): Promise<number> {
    try {
      const cacheKey = `tenant:monthly_voice_calls:${shopDomain}`;
      const cached = await cacheService.get<number>(cacheKey);
      if (cached !== null && cached !== undefined) return cached;

      const now = new Date();
      const monthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      ).toISOString();

      const { count, error } = await (supabaseService as any).serviceClient
        .from('voice_call_logs')
        .select('*', { count: 'exact', head: true })
        .eq('shop_domain', shopDomain)
        .eq('status', 'ended')
        .gte('started_at', monthStart);

      const result = error ? 0 : count || 0;
      await cacheService.set(cacheKey, result, { ttl: 60 });
      return result;
    } catch (error) {
      logger.error('Error in getMonthlyVoiceCallCount:', error);
      return 0;
    }
  }

  /**
   * Invalidate monthly voice call count cache (call after each completed call)
   */
  async invalidateVoiceCallCountCache(shopDomain: string): Promise<void> {
    await cacheService.del(`tenant:monthly_voice_calls:${shopDomain}`);
  }

  /**
   * Get usage info for a tenant
   */
  async getUsageInfo(shopDomain: string): Promise<TenantUsageInfo | null> {
    try {
      const tenant = await this.getTenant(shopDomain);
      if (!tenant) return null;

      const planLimits = await planService.getPlanLimits(tenant.plan);
      const limit = planLimits.monthly_messages;
      const used = await this.getMonthlyMessageCount(shopDomain);
      const isUnlimited = limit === -1;

      const voiceLimit = planLimits.monthly_voice_calls;
      const voiceUsed = await this.getMonthlyVoiceCallCount(shopDomain);
      const voiceUnlimited = voiceLimit === -1;

      return {
        messages_used: used,
        messages_limit: limit,
        messages_remaining: isUnlimited ? -1 : Math.max(0, limit - used),
        usage_percentage: isUnlimited ? 0 : Math.round((used / limit) * 100),
        is_over_limit: !isUnlimited && used >= limit,
        voice_calls_used: voiceUsed,
        voice_calls_limit: voiceLimit,
        voice_calls_remaining: voiceUnlimited ? -1 : Math.max(0, voiceLimit - voiceUsed),
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

    // Check message limit from plan (count from chat_messages)
    const planLimits = await planService.getPlanLimits(tenant.plan);
    if (planLimits.monthly_messages !== -1) {
      const monthlyCount = await this.getMonthlyMessageCount(shopDomain);
      if (monthlyCount >= planLimits.monthly_messages) {
        throw new TenantError(
          'Monthly message limit exceeded. Please upgrade your plan.',
          TenantErrorCode.USAGE_LIMIT_EXCEEDED,
          shopDomain,
          { used: monthlyCount, limit: planLimits.monthly_messages }
        );
      }
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
      trial_ends_at: data.trial_ends_at
        ? new Date(data.trial_ends_at)
        : undefined,
      billing_email: data.billing_email,
      stripe_customer_id: data.stripe_customer_id,
      stripe_subscription_id: data.stripe_subscription_id,
      features: data.features || TENANT_PLAN_LIMITS.free.features,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
      last_activity_at: new Date(data.last_activity_at),
    };
  }
}

// Singleton export
export const tenantService = new TenantService();
