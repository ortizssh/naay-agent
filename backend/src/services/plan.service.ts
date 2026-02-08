import { SupabaseService } from './supabase.service';
import { cacheService } from './cache.service';
import { logger } from '@/utils/logger';
import {
  Plan,
  TenantPlan,
  TenantPlanLimits,
  TENANT_PLAN_LIMITS,
} from '@/types';

const supabaseService = new SupabaseService();

export class PlanService {
  private static readonly CACHE_KEY = 'plans:all';
  private static readonly CACHE_TTL = 300; // 5 minutes

  /**
   * Get all active plans from DB (cached)
   */
  async getAllPlans(): Promise<Plan[]> {
    try {
      const cached = await cacheService.get<Plan[]>(PlanService.CACHE_KEY);
      if (cached) return cached;

      const { data, error } = await (supabaseService as any).serviceClient
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error || !data || data.length === 0) {
        if (error) logger.warn('Error fetching plans from DB, using fallback:', error);
        return this.getFallbackPlans();
      }

      const plans: Plan[] = data.map((row: any) => this.mapDbToPlan(row));

      await cacheService.set(PlanService.CACHE_KEY, plans, {
        ttl: PlanService.CACHE_TTL,
      });

      return plans;
    } catch (error) {
      logger.error('Error in getAllPlans, using fallback:', error);
      return this.getFallbackPlans();
    }
  }

  /**
   * Get a single plan by slug
   */
  async getPlanBySlug(slug: TenantPlan): Promise<Plan | null> {
    const plans = await this.getAllPlans();
    return plans.find(p => p.slug === slug) || null;
  }

  /**
   * Get plan limits compatible with the existing TenantPlanLimits interface
   */
  async getPlanLimits(slug: TenantPlan): Promise<TenantPlanLimits> {
    const plan = await this.getPlanBySlug(slug);
    if (plan) {
      return {
        monthly_messages: plan.monthly_messages,
        products: plan.products_limit,
        features: plan.features,
      };
    }
    // Fallback to hardcoded
    return TENANT_PLAN_LIMITS[slug] || TENANT_PLAN_LIMITS.free;
  }

  /**
   * Invalidate plans cache
   */
  async invalidateCache(): Promise<void> {
    await cacheService.del(PlanService.CACHE_KEY);
  }

  private mapDbToPlan(row: any): Plan {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      price: parseFloat(row.price) || 0,
      currency: row.currency || 'USD',
      billing_period: row.billing_period || 'monthly',
      monthly_messages: row.monthly_messages,
      products_limit: row.products_limit,
      features: row.features || {},
      badge_color: row.badge_color || 'neutral',
      sort_order: row.sort_order || 0,
      is_active: row.is_active ?? true,
    };
  }

  /**
   * Build Plan[] from hardcoded TENANT_PLAN_LIMITS as fallback
   */
  private getFallbackPlans(): Plan[] {
    const fallbackMeta: Record<TenantPlan, { name: string; price: number; badge_color: string; sort_order: number; description: string }> = {
      free: { name: 'Free', price: 0, badge_color: 'neutral', sort_order: 0, description: 'Plan gratuito con funcionalidades básicas' },
      starter: { name: 'Starter', price: 49, badge_color: 'primary', sort_order: 1, description: 'Plan inicial para tiendas en crecimiento' },
      professional: { name: 'Professional', price: 149, badge_color: 'success', sort_order: 2, description: 'Plan profesional para tiendas establecidas' },
      enterprise: { name: 'Enterprise', price: 499, badge_color: 'warning', sort_order: 3, description: 'Plan enterprise con todas las funcionalidades' },
    };

    return (Object.keys(TENANT_PLAN_LIMITS) as TenantPlan[]).map(slug => {
      const limits = TENANT_PLAN_LIMITS[slug];
      const meta = fallbackMeta[slug];
      return {
        id: slug,
        slug,
        name: meta.name,
        description: meta.description,
        price: meta.price,
        currency: 'USD',
        billing_period: 'monthly',
        monthly_messages: limits.monthly_messages,
        products_limit: limits.products,
        features: limits.features,
        badge_color: meta.badge_color,
        sort_order: meta.sort_order,
        is_active: true,
      };
    });
  }
}

// Singleton export
export const planService = new PlanService();
