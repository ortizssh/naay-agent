// Types
export type TenantPlan = 'free' | 'starter' | 'professional' | 'enterprise';
export type TenantStatus = 'active' | 'suspended' | 'cancelled' | 'trial';

export interface Tenant {
  id: string;
  shop_domain: string;
  shop_name?: string;
  shop_email?: string;
  plan: TenantPlan;
  status: TenantStatus;
  trial_ends_at?: string;
  billing_email?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  features: Record<string, boolean>;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
}

export interface DashboardStats {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  totalMessages: number;
  totalProducts: number;
}

export interface ClientStore {
  id: string;
  shop_domain: string;
  platform: 'shopify' | 'woocommerce';
  status: string;
  is_active: boolean;
  chatbot_endpoint?: string;
  widget_brand_name?: string;
  widget_enabled: boolean;
  widget_color?: string;
  widget_secondary_color?: string;
  widget_accent_color?: string;
  widget_position?: string;
  widget_button_size?: number;
  widget_button_style?: string;
  widget_show_pulse?: boolean;
  widget_chat_width?: number;
  widget_chat_height?: number;
  widget_subtitle?: string;
  widget_placeholder?: string;
  widget_avatar?: string;
  widget_show_promo_message?: boolean;
  widget_show_cart?: boolean;
  widget_show_contact?: boolean;
  retell_agent_id?: string;
  widget_enable_animations?: boolean;
  widget_theme?: string;
  welcome_message?: string;
  widget_rotating_messages_enabled?: boolean;
  widget_welcome_message_2?: string;
  widget_welcome_message_3?: string;
  widget_rotating_messages_interval?: number;
  widget_subtitle_2?: string;
  widget_subtitle_3?: string;
  promo_badge_enabled?: boolean;
  promo_badge_discount?: number;
  promo_badge_text?: string;
  promo_badge_color?: string;
  promo_badge_shape?: string;
  promo_badge_position?: string;
  promo_badge_suffix?: string;
  promo_badge_font_size?: number;
  promo_badge_prefix?: string;
  promo_badge_type?: string;
  suggested_question_1_text?: string;
  suggested_question_1_message?: string;
  suggested_question_2_text?: string;
  suggested_question_2_message?: string;
  suggested_question_3_text?: string;
  suggested_question_3_message?: string;
  chat_mode?: 'internal' | 'external';
  ai_model?: string;
  agent_name?: string | null;
  agent_tone?: string;
  brand_description?: string | null;
  agent_instructions?: string | null;
  agent_language?: string;
  products_synced?: number;
  last_sync_at?: string;
  created_at: string;
  updated_at: string;
}

export interface LinkedUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company?: string;
  role: string;
  user_type: string;
  plan?: string;
  status: string;
  last_login_at?: string;
  created_at: string;
}

export interface ClientStats {
  totalMessages: number;
  monthlyMessages: number;
  uniqueSessions: number;
  totalConversions: number;
  totalRevenue: number;
}

export interface Plan {
  id: string;
  slug: TenantPlan;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billing_period: string;
  monthly_messages: number;
  products_limit: number;
  features: Record<string, boolean>;
  badge_color: string;
  sort_order: number;
  is_active: boolean;
}

export interface EnrichedTenant extends Tenant {
  platform?: string;
  chatbot_endpoint?: string;
  widget_enabled?: boolean;
  is_active?: boolean;
  real_message_count?: number;
}

export interface TenantDetail {
  tenant: Tenant;
  clientStore: ClientStore | null;
  linkedUser: LinkedUser | null;
  store: { id: string; platform: string; site_url?: string; widget_enabled: boolean; installed_at: string } | null;
  stats: ClientStats;
}

export interface TenantsResponse {
  tenants: EnrichedTenant[];
  total: number;
}

// API Configuration
const getApiUrl = (): string => {
  // Auto-detect: if running on localhost, always use local backend
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `http://localhost:3000`;
  }

  // Check localStorage (for production API URL override)
  const storedUrl = localStorage.getItem('api_url');
  if (storedUrl) return storedUrl;

  // Check environment variable
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Default to same origin (for production)
  return window.location.origin;
};

// API Client
class ApiClient {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${getApiUrl()}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.data || data;
  }

  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/api/admin/tenants/stats');
  }

  // Plans
  async getPlans(): Promise<Plan[]> {
    return this.request<Plan[]>('/api/admin/tenants/plans/info');
  }

  // Tenants
  async getTenants(params?: {
    page?: number;
    limit?: number;
    status?: TenantStatus;
    plan?: TenantPlan;
  }): Promise<TenantsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.status) searchParams.set('status', params.status);
    if (params?.plan) searchParams.set('plan', params.plan);

    const query = searchParams.toString();
    return this.request<TenantsResponse>(
      `/api/admin/tenants${query ? `?${query}` : ''}`
    );
  }

  async getTenant(shopDomain: string): Promise<Tenant> {
    return this.request<Tenant>(`/api/admin/tenants/${shopDomain}`);
  }

  async getTenantDetail(shopDomain: string): Promise<TenantDetail> {
    return this.request<TenantDetail>(`/api/admin/tenants/${shopDomain}/detail`);
  }

  async createTenant(data: {
    shop_domain: string;
    access_token: string;
    shop_name?: string;
    shop_email?: string;
    plan?: TenantPlan;
    platform?: string;
    chatbot_endpoint?: string;
    widget_brand_name?: string;
  }): Promise<Tenant> {
    return this.request<Tenant>('/api/admin/tenants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTenant(
    shopDomain: string,
    data: Record<string, any>
  ): Promise<Tenant> {
    return this.request<Tenant>(`/api/admin/tenants/${shopDomain}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateTenantStatus(
    shopDomain: string,
    status: TenantStatus
  ): Promise<Tenant> {
    return this.request<Tenant>(`/api/admin/tenants/${shopDomain}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async deleteTenant(shopDomain: string): Promise<void> {
    return this.request<void>(`/api/admin/tenants/${shopDomain}`, {
      method: 'DELETE',
    });
  }

  // Admin Knowledge Base
  async getAdminKnowledgeDocuments(shopDomain: string): Promise<KnowledgeDocument[]> {
    return this.request<KnowledgeDocument[]>(`/api/admin/tenants/${shopDomain}/knowledge`);
  }

  async createAdminKnowledgeDocument(shopDomain: string, data: { title: string; content: string }): Promise<KnowledgeDocument> {
    return this.request<KnowledgeDocument>(`/api/admin/tenants/${shopDomain}/knowledge`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async uploadAdminKnowledgeFile(shopDomain: string, file: File, title?: string): Promise<KnowledgeDocument> {
    const token = localStorage.getItem('auth_token');
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);

    const url = `${getApiUrl()}/api/admin/tenants/${shopDomain}/knowledge/upload`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.data || data;
  }

  async deleteAdminKnowledgeDocument(shopDomain: string, docId: string): Promise<void> {
    return this.request<void>(`/api/admin/tenants/${shopDomain}/knowledge/${docId}`, {
      method: 'DELETE',
    });
  }

  async getAdminKnowledgeDocumentStatus(shopDomain: string, docId: string): Promise<{ embedding_status: string; chunk_count: number; error_message: string | null }> {
    return this.request<{ embedding_status: string; chunk_count: number; error_message: string | null }>(`/api/admin/tenants/${shopDomain}/knowledge/${docId}/status`);
  }
}

export const api = new ApiClient();

// Client API for tenant users
class ClientApiClient {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data: T }> {
    const url = `${getApiUrl()}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Dashboard
  async getDashboard(): Promise<{ success: boolean; data: any }> {
    return this.request('/api/client/dashboard');
  }

  // Store
  async getStore(): Promise<{ success: boolean; data: any }> {
    return this.request('/api/client/store');
  }

  async connectStore(shopDomain: string, platform: string = 'shopify'): Promise<{ success: boolean; data: any }> {
    return this.request('/api/client/store/connect', {
      method: 'POST',
      body: JSON.stringify({ shopDomain, platform }),
    });
  }

  // Widget Config
  async getWidgetConfig(): Promise<{ success: boolean; data: any }> {
    return this.request('/api/client/widget/config');
  }

  async updateWidgetConfig(config: {
    widgetPosition?: string;
    widgetColor?: string;
    welcomeMessage?: string;
    widgetEnabled?: boolean;
    widgetSecondaryColor?: string;
    widgetAccentColor?: string;
    widgetButtonSize?: number;
    widgetButtonStyle?: string;
    widgetShowPulse?: boolean;
    widgetChatWidth?: number;
    widgetChatHeight?: number;
    widgetSubtitle?: string;
    widgetPlaceholder?: string;
    widgetAvatar?: string;
    widgetShowPromoMessage?: boolean;
    widgetShowCart?: boolean;
    widgetShowContact?: boolean;
    retellAgentId?: string;
    widgetEnableAnimations?: boolean;
    widgetTheme?: string;
    widgetBrandName?: string;
  }): Promise<{ success: boolean; data: any }> {
    return this.request('/api/client/widget/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  // Onboarding
  async getOnboarding(): Promise<{ success: boolean; data: any }> {
    return this.request('/api/client/onboarding');
  }

  async updateOnboardingStep(step: number, data?: any): Promise<{ success: boolean; data: any }> {
    return this.request('/api/client/onboarding/step', {
      method: 'POST',
      body: JSON.stringify({ step, data }),
    });
  }

  // Widget Code
  async getWidgetCode(): Promise<{ success: boolean; data: any }> {
    return this.request('/api/client/widget-code');
  }

  // Analytics
  async getAnalytics(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{ success: boolean; data: any }> {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);

    const query = searchParams.toString();
    return this.request(`/api/client/analytics${query ? `?${query}` : ''}`);
  }

  // Conversion Dashboard
  async getConversionDashboard(days: number = 7): Promise<{ success: boolean; data: ConversionDashboardData }> {
    return this.request(`/api/client/conversions/dashboard?days=${days}`);
  }

  // Recent Conversions
  async getRecentConversions(limit: number = 10): Promise<{ success: boolean; data: any[] }> {
    return this.request(`/api/client/conversions/recent?limit=${limit}`);
  }

  // Conversion Stats
  async getConversionStats(days: number = 7): Promise<{ success: boolean; data: any }> {
    return this.request(`/api/client/conversions/stats?days=${days}`);
  }

  // Store Info
  async getStoreInfo(): Promise<{ success: boolean; data: any }> {
    return this.request('/api/client/store/info');
  }

  async updateStoreInfo(data: { brandName?: string; supportEmail?: string }): Promise<{ success: boolean; data: any }> {
    return this.request('/api/client/store/info', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Product Sync
  async triggerSync(): Promise<{ success: boolean; data: any }> {
    return this.request('/api/client/store/sync', {
      method: 'POST',
    });
  }

  async getSyncStatus(): Promise<{ success: boolean; data: { status: string; synced: number; total: number; webhooksConfigured: boolean } }> {
    return this.request('/api/client/store/sync-status');
  }

  // Billing
  async createCheckout(planSlug: string): Promise<{ success: boolean; data: { checkoutUrl?: string; free?: boolean } }> {
    return this.request('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planSlug }),
    });
  }

  async createPortalSession(): Promise<{ success: boolean; data: { portalUrl: string } }> {
    return this.request('/api/billing/portal', {
      method: 'POST',
    });
  }

  async getBillingStatus(): Promise<{ success: boolean; data: any }> {
    return this.request('/api/billing/status');
  }

  async getAvailablePlans(): Promise<{ success: boolean; data: Plan[] }> {
    return this.request('/api/billing/plans');
  }

  async getUsage(): Promise<{ success: boolean; data: {
    messages_used: number;
    messages_limit: number;
    messages_remaining: number;
    usage_percentage: number;
    is_over_limit: boolean;
    products_synced: number;
    products_limit: number;
  } }> {
    return this.request('/api/billing/usage');
  }

  async cancelSubscription(): Promise<{ success: boolean; data: { cancelAtPeriodEnd: boolean; currentPeriodEnd: string } }> {
    return this.request('/api/billing/cancel', { method: 'POST' });
  }

  async reactivateSubscription(): Promise<{ success: boolean; data: { cancelAtPeriodEnd: boolean } }> {
    return this.request('/api/billing/reactivate', { method: 'POST' });
  }

  // Knowledge Base
  async getKnowledgeDocuments(): Promise<{ success: boolean; data: KnowledgeDocument[] }> {
    return this.request('/api/client/knowledge');
  }

  async createKnowledgeDocument(data: { title: string; content: string }): Promise<{ success: boolean; data: KnowledgeDocument }> {
    return this.request('/api/client/knowledge', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async uploadKnowledgeFile(file: File, title?: string): Promise<{ success: boolean; data: KnowledgeDocument }> {
    const token = localStorage.getItem('auth_token');
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);

    const url = `${getApiUrl()}/api/client/knowledge/upload`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async deleteKnowledgeDocument(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/client/knowledge/${id}`, {
      method: 'DELETE',
    });
  }

  async getKnowledgeDocumentStatus(id: string): Promise<{ success: boolean; data: { embedding_status: string; chunk_count: number; error_message: string | null } }> {
    return this.request(`/api/client/knowledge/${id}/status`);
  }

  // AI Config
  async getAiConfig(): Promise<{ success: boolean; data: AiConfig }> {
    return this.request('/api/client/ai-config');
  }

  async updateAiConfig(data: Partial<{
    chatMode: string;
    aiModel: string;
    agentName: string;
    agentTone: string;
    brandDescription: string;
    agentInstructions: string;
    agentLanguage: string;
    chatbotEndpoint: string;
  }>): Promise<{ success: boolean; data: any }> {
    return this.request('/api/client/ai-config', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}

// Knowledge Base Types
export interface KnowledgeDocument {
  id: string;
  shop_domain: string;
  title: string;
  source_type: 'text' | 'file' | 'url';
  original_filename?: string;
  chunk_count: number;
  embedding_status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// AI Config Types
export interface AiConfig {
  chat_mode: 'internal' | 'external';
  ai_model: string;
  agent_name: string | null;
  agent_tone: string;
  brand_description: string | null;
  agent_instructions: string | null;
  agent_language: string;
  chatbot_endpoint: string | null;
}

// Types for Conversion Dashboard
export interface ConversionDashboardData {
  overview: {
    totalRecommendations: number;
    totalConversions: number;
    conversionRate: number;
    totalRevenue: number;
    averageOrderValue: number;
    averageTimeToConversion: number;
  };
  timeline: Array<{
    date: string;
    recommendations: number;
    conversions: number;
    revenue: number;
    conversionRate: number;
  }>;
  topProducts: Array<{
    productId: string;
    productTitle: string;
    recommendations: number;
    conversions: number;
    conversionRate: number;
    revenue: number;
  }>;
  recentActivity: Array<{
    type: 'recommendation' | 'conversion';
    timestamp: string;
    productTitle: string;
    sessionId: string;
    amount?: number;
  }>;
  attributionBreakdown: {
    direct: { count: number; revenue: number };
    assisted: { count: number; revenue: number };
    viewThrough: { count: number; revenue: number };
  };
  periodComparison: {
    currentPeriod: { conversions: number; revenue: number; rate: number };
    previousPeriod: { conversions: number; revenue: number; rate: number };
    change: { conversions: number; revenue: number; rate: number };
  };
}

export const clientApi = new ClientApiClient();

// Auth API
class AuthApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${getApiUrl()}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    return data;
  }

  async login(
    email: string,
    password: string
  ): Promise<{ success: boolean; token?: string; user?: any; message?: string }> {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    company?: string;
    userType?: 'admin' | 'client';
  }): Promise<{ success: boolean; token?: string; user?: any; message?: string }> {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMe(): Promise<{ success: boolean; user?: any; message?: string }> {
    const token = localStorage.getItem('auth_token');
    return this.request('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }
}

export const authApi = new AuthApiClient();
