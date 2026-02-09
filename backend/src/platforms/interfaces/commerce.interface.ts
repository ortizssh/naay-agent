/**
 * Commerce provider interface
 * Main abstraction for e-commerce platform operations
 */

import {
  NormalizedProduct,
  NormalizedProductRecommendation,
  ProductSearchFilters,
  RecommendationOptions,
  Platform,
} from './product.interface';
import { ICartProvider } from './cart.interface';

// Re-export cart types for convenience
export type {
  NormalizedCart,
  CartLineInput,
  CartLineUpdateInput,
  BuyerIdentity,
} from './cart.interface';

/**
 * Webhook topic types (normalized across platforms)
 */
export type WebhookTopic =
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'order.created'
  | 'order.updated'
  | 'order.paid'
  | 'order.cancelled'
  | 'app.uninstalled'
  | 'customer.created'
  | 'customer.updated';

/**
 * Normalized webhook subscription
 */
export interface NormalizedWebhook {
  id: string;
  topic: WebhookTopic;
  callback_url: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Normalized order line item
 */
export interface NormalizedOrderLineItem {
  id: string;
  product_id: string;
  product_external_id: string;
  product_title: string;
  variant_id: string;
  variant_external_id: string;
  variant_title: string;
  quantity: number;
  price: string;
  total: string;
  currency: string;
  sku?: string;
}

/**
 * Normalized order
 */
export interface NormalizedOrder {
  id: string;
  external_id: string;
  platform: Platform;
  order_number: string;
  status: string;
  financial_status: string;
  fulfillment_status?: string;
  created_at: string;
  updated_at?: string;
  currency: string;
  subtotal: string;
  total_tax: string;
  total_shipping?: string;
  total_discount?: string;
  total: string;
  line_items: NormalizedOrderLineItem[];
  customer?: {
    id: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  };
  shipping_address?: {
    address1?: string;
    address2?: string;
    city?: string;
    province?: string;
    country?: string;
    zip?: string;
  };
  note?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Store/Shop information
 */
export interface NormalizedStore {
  id: string;
  platform: Platform;
  identifier: string; // shop domain for Shopify, site URL for WooCommerce
  name?: string;
  email?: string;
  currency: string;
  timezone?: string;
  plan?: string;
  created_at?: string;
}

/**
 * Store credentials (platform-specific)
 */
export interface StoreCredentials {
  platform: Platform;
  // Shopify
  access_token?: string;
  storefront_token?: string;
  // WooCommerce
  consumer_key?: string;
  consumer_secret?: string;
  webhook_secret?: string;
  siteUrl?: string;
}

/**
 * Commerce provider interface
 * All platform implementations must implement this interface
 */
export interface ICommerceProvider {
  /**
   * Platform identifier
   */
  readonly platform: Platform;

  // ==================== Product Operations ====================

  /**
   * Get all products from the store (with pagination handled internally)
   */
  getAllProducts(storeIdentifier: string): Promise<NormalizedProduct[]>;

  /**
   * Get a single product by ID
   */
  getProduct(
    storeIdentifier: string,
    productId: string
  ): Promise<NormalizedProduct | null>;

  /**
   * Search products with filters
   */
  searchProducts(
    storeIdentifier: string,
    filters: ProductSearchFilters
  ): Promise<NormalizedProduct[]>;

  /**
   * Get product recommendations
   */
  getProductRecommendations(
    storeIdentifier: string,
    options: RecommendationOptions
  ): Promise<NormalizedProductRecommendation[]>;

  // ==================== Cart Operations ====================

  /**
   * Get cart provider for cart operations
   * This allows for separate cart service implementations
   */
  getCartProvider(): ICartProvider;

  // ==================== Webhook Operations ====================

  /**
   * Create/register webhooks for the store
   */
  createWebhooks(
    storeIdentifier: string,
    topics?: WebhookTopic[]
  ): Promise<NormalizedWebhook[]>;

  /**
   * List registered webhooks
   */
  listWebhooks(storeIdentifier: string): Promise<NormalizedWebhook[]>;

  /**
   * Delete a webhook subscription
   */
  deleteWebhook(storeIdentifier: string, webhookId: string): Promise<void>;

  /**
   * Verify webhook signature/authenticity
   */
  verifyWebhook(payload: string, signature: string): boolean;

  // ==================== Order Operations ====================

  /**
   * Get orders within a date range
   */
  getOrdersByDateRange(
    storeIdentifier: string,
    startDate: string,
    endDate: string
  ): Promise<NormalizedOrder[]>;

  /**
   * Get a single order by ID
   */
  getOrder(
    storeIdentifier: string,
    orderId: string
  ): Promise<NormalizedOrder | null>;

  // ==================== Store Operations ====================

  /**
   * Get store information
   */
  getStoreInfo(storeIdentifier: string): Promise<NormalizedStore | null>;

  /**
   * Validate store credentials/connection
   */
  validateConnection(storeIdentifier: string): Promise<boolean>;
}

/**
 * Authentication provider interface
 * Handles platform-specific auth flows
 */
export interface IAuthProvider {
  /**
   * Platform identifier
   */
  readonly platform: Platform;

  /**
   * Generate OAuth install/authorization URL (for Shopify)
   * For WooCommerce, this would be a verification URL
   */
  generateAuthUrl(storeIdentifier: string, redirectUri: string): string;

  /**
   * Exchange authorization code for access token (Shopify OAuth)
   * For WooCommerce, validates API key credentials
   */
  exchangeCodeForToken(storeIdentifier: string, code: string): Promise<string>;

  /**
   * Validate and refresh credentials if needed
   */
  validateCredentials(storeIdentifier: string): Promise<boolean>;
}

/**
 * Factory function type for creating commerce providers
 */
export type CommerceProviderFactory = (
  credentials: StoreCredentials
) => ICommerceProvider;

/**
 * Registry of commerce providers by platform
 */
export const commerceProviders: Map<Platform, CommerceProviderFactory> =
  new Map();

/**
 * Register a commerce provider factory
 */
export function registerCommerceProvider(
  platform: Platform,
  factory: CommerceProviderFactory
): void {
  commerceProviders.set(platform, factory);
}

/**
 * Get a commerce provider for a platform
 */
export function getCommerceProvider(
  platform: Platform,
  credentials: StoreCredentials
): ICommerceProvider {
  const factory = commerceProviders.get(platform);
  if (!factory) {
    throw new Error(
      `No commerce provider registered for platform: ${platform}`
    );
  }
  return factory(credentials);
}
