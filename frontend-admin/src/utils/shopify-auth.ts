/**
 * Modern Shopify Authentication Utilities for App Bridge 3.0
 * Handles Session Token authentication for embedded apps
 */

import { createApp, getSessionToken } from '@shopify/app-bridge';
import { Redirect } from '@shopify/app-bridge/actions';
import { useState, useEffect, useMemo } from 'react';

// App Bridge instance (to be initialized)
let app: any = null;
let sessionTokenPromise: Promise<string> | null = null;

/**
 * Initialize App Bridge with modern authentication
 */
export function initializeAppBridge(config: {
  apiKey: string;
  host: string;
  forceRedirect?: boolean;
}): void {
  try {
    app = createApp({
      apiKey: config.apiKey,
      host: config.host,
      forceRedirect: config.forceRedirect,
    });

    console.log('App Bridge initialized successfully');
  } catch (error) {
    console.error('Failed to initialize App Bridge:', error);
    throw new Error('App Bridge initialization failed');
  }
}

/**
 * Get current session token with automatic renewal
 */
export async function getAuthenticatedSessionToken(): Promise<string> {
  if (!app) {
    throw new Error('App Bridge not initialized. Call initializeAppBridge() first.');
  }

  try {
    // Use cached promise if available to prevent multiple simultaneous requests
    if (!sessionTokenPromise) {
      sessionTokenPromise = getSessionToken(app);
    }

    const token = await sessionTokenPromise;
    
    // Clear the promise after successful resolution
    sessionTokenPromise = null;
    
    if (!token) {
      throw new Error('Failed to obtain session token');
    }

    return token;
  } catch (error) {
    sessionTokenPromise = null;
    console.error('Session token error:', error);
    throw new Error(`Session token error: ${error.message}`);
  }
}

/**
 * Create authenticated fetch function that automatically includes session tokens
 */
export function createAuthenticatedFetch() {
  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    try {
      const sessionToken = await getAuthenticatedSessionToken();

      const authenticatedOptions: RequestInit = {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          ...options.headers,
        },
      };

      const response = await fetch(url, authenticatedOptions);

      // Handle authentication errors
      if (response.status === 401) {
        console.warn('Authentication failed, redirecting to re-authenticate...');
        handleAuthenticationError();
        throw new Error('Authentication failed');
      }

      return response;
    } catch (error) {
      console.error('Authenticated fetch error:', error);
      throw error;
    }
  };
}

/**
 * Handle authentication errors by redirecting to OAuth
 */
function handleAuthenticationError(): void {
  if (app) {
    const redirect = Redirect.create(app);
    const shopDomain = getShopDomainFromUrl();
    
    if (shopDomain) {
      redirect.dispatch(
        Redirect.Action.REMOTE,
        `${window.location.origin}/auth/install?shop=${shopDomain}`
      );
    } else {
      console.error('Unable to determine shop domain for redirect');
    }
  }
}

/**
 * Extract shop domain from current URL
 */
function getShopDomainFromUrl(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  const host = urlParams.get('host');
  
  if (host) {
    try {
      // Decode base64 host parameter
      const decoded = atob(host);
      const shopDomain = decoded.split('/')[0];
      return shopDomain;
    } catch (error) {
      console.error('Error decoding host parameter:', error);
    }
  }
  
  // Fallback: try to get from shop parameter
  return urlParams.get('shop');
}

/**
 * Verify current authentication status
 */
export async function verifyAuthentication(): Promise<{
  isAuthenticated: boolean;
  shop?: string;
  error?: string;
}> {
  try {
    const authenticatedFetch = createAuthenticatedFetch();
    const response = await authenticatedFetch('/api/auth/session');
    
    if (response.ok) {
      const data = await response.json();
      return {
        isAuthenticated: true,
        shop: data.data?.shop,
      };
    } else {
      return {
        isAuthenticated: false,
        error: 'Authentication verification failed',
      };
    }
  } catch (error) {
    return {
      isAuthenticated: false,
      error: error.message,
    };
  }
}

/**
 * React hook for App Bridge authentication
 */
export function useShopifyAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [shop, setShop] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        setIsLoading(true);
        setError(null);

        const result = await verifyAuthentication();
        
        setIsAuthenticated(result.isAuthenticated);
        setShop(result.shop || null);
        
        if (result.error) {
          setError(result.error);
        }
      } catch (err) {
        setError(err.message);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, []);

  const authenticatedFetch = useMemo(() => {
    return createAuthenticatedFetch();
  }, []);

  return {
    isAuthenticated,
    isLoading,
    shop,
    error,
    authenticatedFetch,
    refreshAuth: () => verifyAuthentication(),
  };
}

/**
 * Initialize authentication for the app
 */
export async function initializeAuthentication(config: {
  apiKey: string;
  host: string;
}): Promise<{
  success: boolean;
  shop?: string;
  error?: string;
}> {
  try {
    // Initialize App Bridge
    initializeAppBridge(config);

    // Verify authentication
    const authResult = await verifyAuthentication();

    if (!authResult.isAuthenticated) {
      return {
        success: false,
        error: authResult.error || 'Authentication failed',
      };
    }

    return {
      success: true,
      shop: authResult.shop,
    };
  } catch (error) {
    console.error('Authentication initialization failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Logout function (clears local state)
 */
export function logout(): void {
  // Clear any cached tokens or state
  sessionTokenPromise = null;
  
  // Redirect to main page
  window.location.href = '/';
}