/**
 * Platform-agnostic cart types and interfaces
 */

import { Platform } from './product.interface';

/**
 * Cart line item
 */
export interface NormalizedCartLine {
  id: string;
  quantity: number;
  variant_id: string;
  variant_external_id: string;
  variant_title: string;
  product_id: string;
  product_title: string;
  product_handle?: string;
  price: {
    amount: string;
    currency: string;
  };
  compare_at_price?: {
    amount: string;
    currency: string;
  };
  image?: {
    src: string;
    alt_text?: string;
  };
  options?: Array<{
    name: string;
    value: string;
  }>;
  attributes?: Array<{
    key: string;
    value: string;
  }>;
}

/**
 * Cart cost breakdown
 */
export interface NormalizedCartCost {
  subtotal: {
    amount: string;
    currency: string;
  };
  total: {
    amount: string;
    currency: string;
  };
  tax?: {
    amount: string;
    currency: string;
  };
  shipping?: {
    amount: string;
    currency: string;
  };
  discount?: {
    amount: string;
    currency: string;
  };
}

/**
 * Buyer identity for cart
 */
export interface BuyerIdentity {
  email?: string;
  phone?: string;
  customerAccessToken?: string; // Platform-specific auth token
  customerId?: string;
}

/**
 * Normalized cart
 */
export interface NormalizedCart {
  id: string;
  platform: Platform;
  lines: NormalizedCartLine[];
  cost: NormalizedCartCost;
  total_quantity: number;
  checkout_url: string;
  note?: string;
  attributes?: Array<{
    key: string;
    value: string;
  }>;
  buyer_identity?: BuyerIdentity;
  created_at?: string;
  updated_at?: string;
}

/**
 * Input for adding items to cart
 */
export interface CartLineInput {
  variant_id: string; // Normalized variant ID or external ID
  quantity: number;
  attributes?: Array<{
    key: string;
    value: string;
  }>;
}

/**
 * Input for updating cart line quantities
 */
export interface CartLineUpdateInput {
  line_id: string;
  quantity: number;
}

/**
 * Cart provider interface
 * Platform implementations must implement this interface
 */
export interface ICartProvider {
  /**
   * Create a new cart
   */
  createCart(
    storeIdentifier: string,
    buyerIdentity?: BuyerIdentity
  ): Promise<NormalizedCart>;

  /**
   * Get cart by ID
   */
  getCart(
    storeIdentifier: string,
    cartId: string
  ): Promise<NormalizedCart | null>;

  /**
   * Add items to cart
   */
  addToCart(
    storeIdentifier: string,
    cartId: string,
    lines: CartLineInput[]
  ): Promise<NormalizedCart>;

  /**
   * Update cart line quantities
   */
  updateCartLines(
    storeIdentifier: string,
    cartId: string,
    lines: CartLineUpdateInput[]
  ): Promise<NormalizedCart>;

  /**
   * Remove items from cart
   */
  removeFromCart(
    storeIdentifier: string,
    cartId: string,
    lineIds: string[]
  ): Promise<NormalizedCart>;

  /**
   * Clear all items from cart
   */
  clearCart(
    storeIdentifier: string,
    cartId: string
  ): Promise<NormalizedCart>;

  /**
   * Update buyer identity on cart
   */
  updateBuyerIdentity(
    storeIdentifier: string,
    cartId: string,
    buyerIdentity: BuyerIdentity
  ): Promise<NormalizedCart>;

  /**
   * Get checkout URL for cart
   */
  getCheckoutUrl(
    storeIdentifier: string,
    cartId: string
  ): Promise<string>;
}
