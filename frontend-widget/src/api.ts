import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ChatResponse, ChatSession, WidgetConfig } from './types';

export class ChatAPI {
  private client: AxiosInstance;
  private config: WidgetConfig;

  constructor(config: WidgetConfig) {
    this.config = config;

    this.client = axios.create({
      baseURL: config.apiEndpoint,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Shop-Domain': config.shopDomain,
      },
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        console.error('Naay API Error:', error);
        throw this.formatError(error);
      }
    );
  }

  async createSession(
    customerId?: string,
    cartId?: string
  ): Promise<ChatSession> {
    try {
      const response: AxiosResponse<{ success: boolean; data: ChatSession }> =
        await this.client.post('/api/chat/session', {
          customer_id: customerId,
          cart_id: cartId,
          context: {
            user_agent: navigator.userAgent,
            referrer: document.referrer,
            timestamp: new Date().toISOString(),
          },
        });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create session');
      }

      return response.data.data;
    } catch (error) {
      console.error('Error creating chat session:', error);
      throw error;
    }
  }

  async sendMessage(
    message: string,
    sessionId: string,
    cartId?: string,
    context?: Record<string, any>
  ): Promise<ChatResponse> {
    try {
      const response: AxiosResponse<ChatResponse> = await this.client.post(
        '/api/chat/message',
        {
          message,
          session_id: sessionId,
          cart_id: cartId,
          context: {
            timestamp: new Date().toISOString(),
            page_url: window.location.href,
            page_title: document.title,
            ...context,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async getHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/chat/health');
      return response.data.success;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  private formatError(error: any): Error {
    if (error.response) {
      // Server responded with error status
      const message =
        error.response.data?.error ||
        error.response.data?.message ||
        `Server error: ${error.response.status}`;
      return new Error(message);
    } else if (error.request) {
      // Request made but no response
      return new Error(
        'Unable to connect to chat service. Please check your internet connection.'
      );
    } else {
      // Something else happened
      return new Error(error.message || 'An unexpected error occurred');
    }
  }
}

// Utility functions for cart management
export class CartUtils {
  static getCartId(): string | null {
    try {
      // Try to get Shopify cart ID from various sources

      // 1. From localStorage (if stored by theme)
      let cartId =
        localStorage.getItem('naay-cart-id') ||
        localStorage.getItem('shopify-cart-id');

      if (cartId) return cartId;

      // 2. From Shopify's cart.js if available
      if (typeof window !== 'undefined' && (window as any).ShopifyAnalytics) {
        const analytics = (window as any).ShopifyAnalytics;
        cartId = analytics.meta?.cart?.id;
        if (cartId) return cartId;
      }

      // 3. From global Shopify object
      if (typeof window !== 'undefined' && (window as any).Shopify) {
        cartId = (window as any).Shopify.checkout?.id;
        if (cartId) return cartId;
      }

      // 4. Try to extract from cart cookies
      const cartCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('cart='));

      if (cartCookie) {
        try {
          const cartData = JSON.parse(
            decodeURIComponent(cartCookie.split('=')[1])
          );
          cartId = cartData.token || cartData.id;
          if (cartId) return cartId;
        } catch (e) {
          console.warn('Could not parse cart cookie:', e);
        }
      }

      return null;
    } catch (error) {
      console.warn('Error getting cart ID:', error);
      return null;
    }
  }

  static setCartId(cartId: string): void {
    try {
      localStorage.setItem('naay-cart-id', cartId);
    } catch (error) {
      console.warn('Could not save cart ID:', error);
    }
  }

  static getCustomerId(): string | null {
    try {
      // Try to get customer ID from Shopify globals
      if (typeof window !== 'undefined' && (window as any).ShopifyAnalytics) {
        const analytics = (window as any).ShopifyAnalytics;
        return analytics.meta?.customer?.id || null;
      }

      // Try from customer cookies or localStorage
      const customerId = localStorage.getItem('shopify-customer-id');
      return customerId;
    } catch (error) {
      console.warn('Error getting customer ID:', error);
      return null;
    }
  }
}

// Browser detection utilities
export class BrowserUtils {
  static isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }

  static supportsLocalStorage(): boolean {
    try {
      const test = 'naay-test';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  static detectTheme(): 'light' | 'dark' {
    if (
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
    return 'light';
  }

  static addAccessibilityAttributes(element: HTMLElement): void {
    // Add ARIA attributes for better accessibility
    if (!element.hasAttribute('role')) {
      element.setAttribute('role', 'complementary');
    }

    if (!element.hasAttribute('aria-label')) {
      element.setAttribute('aria-label', 'Customer support chat');
    }
  }
}
