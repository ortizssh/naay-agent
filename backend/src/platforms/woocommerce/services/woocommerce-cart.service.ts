/**
 * WooCommerce Cart Service
 * Implements ICartProvider using WooCommerce Store API
 */

import {
  ICartProvider,
  NormalizedCart,
  NormalizedCartLine,
  CartLineInput,
  CartLineUpdateInput,
  BuyerIdentity,
} from '../../interfaces';
import { WooCredentials, WooStoreCart, WooStoreCartItem } from '../types';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';

/**
 * WooCommerce Store API Client
 * Uses the Store API (v1) for cart operations
 * Note: Store API is stateless and cart is tied to session/customer
 */
class WooStoreApiClient {
  private baseUrl: string;

  constructor(siteUrl: string) {
    this.baseUrl = siteUrl.replace(/\/$/, '');
  }

  /**
   * Make request to WooCommerce Store API
   * Store API uses a different authentication method (nonce-based for frontend)
   * For server-side, we use a cart token approach
   */
  async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: Record<string, unknown>,
    cartToken?: string
  ): Promise<T> {
    const url = `${this.baseUrl}/wp-json/wc/store/v1${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    // If we have a cart token, use it for authentication
    if (cartToken) {
      headers['Cart-Token'] = cartToken;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);

      // Get cart token from response if available
      const newCartToken = response.headers.get('Cart-Token');

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WooCommerce Store API error (${response.status}): ${errorText}`);
      }

      const result = await response.json();

      // Attach cart token to result if available
      if (newCartToken && typeof result === 'object') {
        (result as Record<string, unknown>).__cartToken = newCartToken;
      }

      return result as T;
    } catch (error) {
      logger.error('WooCommerce Store API request failed:', error);
      throw error;
    }
  }
}

/**
 * WooCommerce Cart Provider
 */
export class WooCommerceCartService implements ICartProvider {
  private credentials: WooCredentials;
  private storeClient: WooStoreApiClient;
  private cartTokens: Map<string, string> = new Map(); // Map cart ID to cart token

  constructor(credentials: WooCredentials) {
    this.credentials = credentials;
    this.storeClient = new WooStoreApiClient(credentials.siteUrl);
  }

  async createCart(
    _storeIdentifier: string,
    _buyerIdentity?: BuyerIdentity
  ): Promise<NormalizedCart> {
    try {
      // WooCommerce doesn't have explicit cart creation
      // Get current cart (creates one if doesn't exist)
      const cart = await this.storeClient.request<WooStoreCart & { __cartToken?: string }>('/cart');

      // Store the cart token for future requests
      const cartToken = cart.__cartToken;
      if (cartToken) {
        this.cartTokens.set(this.generateCartId(cartToken), cartToken);
      }

      logger.info('WooCommerce cart retrieved/created', {
        itemsCount: cart.items_count,
      });

      return this.normalizeCart(cart, cartToken);
    } catch (error) {
      logger.error('Error creating WooCommerce cart:', error);
      throw new AppError(`Failed to create cart: ${error}`, 500);
    }
  }

  async getCart(
    _storeIdentifier: string,
    cartId: string
  ): Promise<NormalizedCart | null> {
    try {
      const cartToken = this.cartTokens.get(cartId) || cartId;
      const cart = await this.storeClient.request<WooStoreCart>('/cart', 'GET', undefined, cartToken);
      return this.normalizeCart(cart, cartToken);
    } catch (error) {
      if ((error as Error).message?.includes('404')) {
        return null;
      }
      logger.error('Error fetching WooCommerce cart:', error);
      return null;
    }
  }

  async addToCart(
    _storeIdentifier: string,
    cartId: string,
    lines: CartLineInput[]
  ): Promise<NormalizedCart> {
    try {
      const cartToken = this.cartTokens.get(cartId) || cartId;

      // Add items one by one (Store API adds one item per request)
      for (const line of lines) {
        const productId = this.extractProductId(line.variant_id);
        const variationId = this.extractVariationId(line.variant_id);

        await this.storeClient.request<WooStoreCart>(
          '/cart/add-item',
          'POST',
          {
            id: parseInt(productId),
            quantity: line.quantity,
            ...(variationId && { variation_id: parseInt(variationId) }),
          },
          cartToken
        );
      }

      // Get updated cart
      const updatedCart = await this.storeClient.request<WooStoreCart>('/cart', 'GET', undefined, cartToken);

      logger.info('Items added to WooCommerce cart', {
        itemsAdded: lines.length,
        totalItems: updatedCart.items_count,
      });

      return this.normalizeCart(updatedCart, cartToken);
    } catch (error) {
      logger.error('Error adding to WooCommerce cart:', error);
      throw new AppError(`Failed to add to cart: ${error}`, 500);
    }
  }

  async updateCartLines(
    _storeIdentifier: string,
    cartId: string,
    lines: CartLineUpdateInput[]
  ): Promise<NormalizedCart> {
    try {
      const cartToken = this.cartTokens.get(cartId) || cartId;

      // Update items one by one
      for (const line of lines) {
        await this.storeClient.request<WooStoreCart>(
          '/cart/update-item',
          'POST',
          {
            key: line.line_id,
            quantity: line.quantity,
          },
          cartToken
        );
      }

      // Get updated cart
      const updatedCart = await this.storeClient.request<WooStoreCart>('/cart', 'GET', undefined, cartToken);

      logger.info('WooCommerce cart lines updated', {
        linesUpdated: lines.length,
        totalItems: updatedCart.items_count,
      });

      return this.normalizeCart(updatedCart, cartToken);
    } catch (error) {
      logger.error('Error updating WooCommerce cart:', error);
      throw new AppError(`Failed to update cart: ${error}`, 500);
    }
  }

  async removeFromCart(
    _storeIdentifier: string,
    cartId: string,
    lineIds: string[]
  ): Promise<NormalizedCart> {
    try {
      const cartToken = this.cartTokens.get(cartId) || cartId;

      // Remove items one by one
      for (const lineId of lineIds) {
        await this.storeClient.request<WooStoreCart>(
          '/cart/remove-item',
          'POST',
          {
            key: lineId,
          },
          cartToken
        );
      }

      // Get updated cart
      const updatedCart = await this.storeClient.request<WooStoreCart>('/cart', 'GET', undefined, cartToken);

      logger.info('Items removed from WooCommerce cart', {
        itemsRemoved: lineIds.length,
        totalItems: updatedCart.items_count,
      });

      return this.normalizeCart(updatedCart, cartToken);
    } catch (error) {
      logger.error('Error removing from WooCommerce cart:', error);
      throw new AppError(`Failed to remove from cart: ${error}`, 500);
    }
  }

  async clearCart(
    _storeIdentifier: string,
    cartId: string
  ): Promise<NormalizedCart> {
    try {
      const cartToken = this.cartTokens.get(cartId) || cartId;

      // Get current cart to find all item keys
      const currentCart = await this.storeClient.request<WooStoreCart>('/cart', 'GET', undefined, cartToken);

      // Remove all items
      for (const item of currentCart.items) {
        await this.storeClient.request<WooStoreCart>(
          '/cart/remove-item',
          'POST',
          { key: item.key },
          cartToken
        );
      }

      // Get updated (empty) cart
      const updatedCart = await this.storeClient.request<WooStoreCart>('/cart', 'GET', undefined, cartToken);

      logger.info('WooCommerce cart cleared');

      return this.normalizeCart(updatedCart, cartToken);
    } catch (error) {
      logger.error('Error clearing WooCommerce cart:', error);
      throw new AppError(`Failed to clear cart: ${error}`, 500);
    }
  }

  async updateBuyerIdentity(
    _storeIdentifier: string,
    cartId: string,
    buyerIdentity: BuyerIdentity
  ): Promise<NormalizedCart> {
    try {
      const cartToken = this.cartTokens.get(cartId) || cartId;

      // Update customer data on cart
      await this.storeClient.request<WooStoreCart>(
        '/cart/update-customer',
        'POST',
        {
          billing_address: {
            email: buyerIdentity.email,
            phone: buyerIdentity.phone,
          },
        },
        cartToken
      );

      // Get updated cart
      const updatedCart = await this.storeClient.request<WooStoreCart>('/cart', 'GET', undefined, cartToken);

      return this.normalizeCart(updatedCart, cartToken);
    } catch (error) {
      logger.error('Error updating buyer identity:', error);
      throw new AppError(`Failed to update buyer identity: ${error}`, 500);
    }
  }

  async getCheckoutUrl(
    _storeIdentifier: string,
    _cartId: string
  ): Promise<string> {
    // WooCommerce checkout URL is always at /checkout
    return `${this.credentials.siteUrl}/checkout`;
  }

  // ==================== Helper Methods ====================

  /**
   * Normalize WooCommerce Store API cart to platform-agnostic format
   */
  private normalizeCart(cart: WooStoreCart, cartToken?: string): NormalizedCart {
    const cartId = cartToken ? this.generateCartId(cartToken) : `woo-cart-${Date.now()}`;

    return {
      id: cartId,
      platform: 'woocommerce',
      lines: cart.items.map(item => this.normalizeCartItem(item)),
      cost: {
        subtotal: {
          amount: this.formatPrice(cart.totals.subtotal, cart.totals.currency_minor_unit),
          currency: cart.totals.currency_code,
        },
        total: {
          amount: this.formatPrice(cart.totals.total_price, cart.totals.currency_minor_unit),
          currency: cart.totals.currency_code,
        },
        tax: {
          amount: this.formatPrice(cart.totals.total_tax, cart.totals.currency_minor_unit),
          currency: cart.totals.currency_code,
        },
        shipping: cart.totals.shipping_total ? {
          amount: this.formatPrice(cart.totals.shipping_total, cart.totals.currency_minor_unit),
          currency: cart.totals.currency_code,
        } : undefined,
        discount: cart.totals.discount_total ? {
          amount: this.formatPrice(cart.totals.discount_total, cart.totals.currency_minor_unit),
          currency: cart.totals.currency_code,
        } : undefined,
      },
      total_quantity: cart.items_count,
      checkout_url: `${this.credentials.siteUrl}/checkout`,
    };
  }

  /**
   * Normalize cart item
   */
  private normalizeCartItem(item: WooStoreCartItem): NormalizedCartLine {
    return {
      id: item.key,
      quantity: item.quantity,
      variant_id: `woocommerce-var-${item.id}`,
      variant_external_id: item.id.toString(),
      variant_title: item.variation.length > 0
        ? item.variation.map(v => v.value).join(' / ')
        : 'Default',
      product_id: `woocommerce-${item.id}`,
      product_title: item.name,
      product_handle: new URL(item.permalink).pathname.replace(/^\/product\/|\/$/g, ''),
      price: {
        amount: this.formatPrice(item.prices.price, item.prices.currency_minor_unit),
        currency: item.prices.currency_code,
      },
      compare_at_price: item.prices.regular_price !== item.prices.price ? {
        amount: this.formatPrice(item.prices.regular_price, item.prices.currency_minor_unit),
        currency: item.prices.currency_code,
      } : undefined,
      image: item.images[0] ? {
        src: item.images[0].src,
        alt_text: item.images[0].alt,
      } : undefined,
      options: item.variation.map(v => ({
        name: v.attribute,
        value: v.value,
      })),
    };
  }

  /**
   * Format price from minor units to decimal string
   */
  private formatPrice(price: string, minorUnit: number): string {
    const priceNumber = parseInt(price) / Math.pow(10, minorUnit);
    return priceNumber.toFixed(2);
  }

  /**
   * Generate a cart ID from cart token
   */
  private generateCartId(cartToken: string): string {
    // Create a shorter hash of the cart token
    const crypto = require('crypto');
    return `woo-${crypto.createHash('md5').update(cartToken).digest('hex').substring(0, 12)}`;
  }

  /**
   * Extract product ID from variant ID
   */
  private extractProductId(variantId: string): string {
    // Handle normalized IDs like "woocommerce-var-123" or just "123"
    const match = variantId.match(/(?:woocommerce-(?:var-)?)?(\d+)/);
    return match ? match[1] : variantId;
  }

  /**
   * Extract variation ID if present
   */
  private extractVariationId(variantId: string): string | null {
    // Check if this is a variation ID
    const match = variantId.match(/woocommerce-var-(\d+)/);
    return match ? match[1] : null;
  }
}
