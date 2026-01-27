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
  monthly_messages_limit: number;
  monthly_messages_used: number;
  products_limit: number;
  billing_email?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  features: Record<string, boolean>;
  settings: Record<string, any>;
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

export interface TenantsResponse {
  tenants: Tenant[];
  total: number;
}

// API Configuration
const getApiUrl = (): string => {
  // Check localStorage first
  const storedUrl = localStorage.getItem('api_url');
  if (storedUrl) return storedUrl;

  // Check environment variable
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Auto-detect: if running on localhost, use local backend
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `http://localhost:3000`;
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

  async createTenant(data: {
    shop_domain: string;
    access_token: string;
    shop_name?: string;
    shop_email?: string;
    plan?: TenantPlan;
  }): Promise<Tenant> {
    return this.request<Tenant>('/api/admin/tenants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTenant(
    shopDomain: string,
    data: {
      plan?: TenantPlan;
      shop_name?: string;
      shop_email?: string;
    }
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
