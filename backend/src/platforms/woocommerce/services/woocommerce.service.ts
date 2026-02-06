/**
 * WooCommerce Service
 * Implements ICommerceProvider for WooCommerce stores
 */

import crypto from 'crypto';
import {
  ICommerceProvider,
  ICartProvider,
  NormalizedProduct,
  NormalizedProductRecommendation,
  ProductSearchFilters,
  RecommendationOptions,
  NormalizedWebhook,
  WebhookTopic,
  NormalizedOrder,
  NormalizedStore,
  Platform,
  generateNormalizedId,
  generateVariantId,
} from '../../interfaces';
import { WooCommerceCartService } from './woocommerce-cart.service';
import {
  WooProduct,
  WooProductVariation,
  WooOrder,
  WooWebhook,
  WooCredentials,
  WooConnectionTestResult,
} from '../types';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';

/**
 * WooCommerce REST API Client
 */
class WooCommerceApiClient {
  private baseUrl: string;
  private consumerKey: string;
  private consumerSecret: string;

  constructor(siteUrl: string, consumerKey: string, consumerSecret: string) {
    // Ensure site URL doesn't have trailing slash
    this.baseUrl = siteUrl.replace(/\/$/, '');
    this.consumerKey = consumerKey;
    this.consumerSecret = consumerSecret;
  }

  /**
   * Make authenticated request to WooCommerce REST API
   */
  async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: Record<string, unknown>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}/wp-json/wc/v3${endpoint}`);

    // Add OAuth parameters for authentication
    const oauthParams = this.getOAuthParams(method, url.toString());
    Object.entries(oauthParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url.toString(), options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `WooCommerce API error (${response.status}): ${errorText}`
        );
      }

      return response.json() as Promise<T>;
    } catch (error) {
      logger.error('WooCommerce API request failed:', error);
      throw error;
    }
  }

  /**
   * Generate OAuth 1.0a parameters
   * WooCommerce REST API uses OAuth 1.0a for authentication
   */
  private getOAuthParams(method: string, url: string): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.consumerKey,
      oauth_signature_method: 'HMAC-SHA256',
      oauth_timestamp: timestamp,
      oauth_nonce: nonce,
      oauth_version: '1.0',
    };

    // Generate signature
    const signature = this.generateOAuthSignature(method, url, oauthParams);
    oauthParams.oauth_signature = signature;

    return oauthParams;
  }

  /**
   * Generate OAuth signature
   */
  private generateOAuthSignature(
    method: string,
    url: string,
    params: Record<string, string>
  ): string {
    // Parse URL and combine with OAuth params
    const urlObj = new URL(url);
    const allParams: Record<string, string> = { ...params };

    urlObj.searchParams.forEach((value, key) => {
      allParams[key] = value;
    });

    // Sort parameters
    const sortedParams = Object.keys(allParams)
      .sort()
      .map(
        key =>
          `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`
      )
      .join('&');

    // Create base string
    const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    const baseString = [
      method.toUpperCase(),
      encodeURIComponent(baseUrl),
      encodeURIComponent(sortedParams),
    ].join('&');

    // Create signing key (consumer secret + &)
    const signingKey = `${encodeURIComponent(this.consumerSecret)}&`;

    // Generate HMAC-SHA256 signature
    return crypto
      .createHmac('sha256', signingKey)
      .update(baseString)
      .digest('base64');
  }

  /**
   * Get all items with pagination
   */
  async getAllPaginated<T>(
    endpoint: string,
    perPage: number = 100
  ): Promise<T[]> {
    const items: T[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const pageEndpoint = `${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${page}&per_page=${perPage}`;
      const pageItems = await this.request<T[]>(pageEndpoint);

      items.push(...pageItems);

      if (pageItems.length < perPage) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return items;
  }
}

/**
 * WooCommerce Commerce Provider
 */
export class WooCommerceService implements ICommerceProvider {
  readonly platform: Platform = 'woocommerce';

  private credentials: WooCredentials;
  private client: WooCommerceApiClient;
  private cartProvider: WooCommerceCartService;

  constructor(credentials: WooCredentials) {
    this.credentials = credentials;
    this.client = new WooCommerceApiClient(
      credentials.siteUrl,
      credentials.consumerKey,
      credentials.consumerSecret
    );
    this.cartProvider = new WooCommerceCartService(credentials);
  }

  // ==================== Product Operations ====================

  async getAllProducts(_storeIdentifier: string): Promise<NormalizedProduct[]> {
    try {
      logger.info('Fetching all products from WooCommerce', {
        siteUrl: this.credentials.siteUrl,
      });

      const products =
        await this.client.getAllPaginated<WooProduct>('/products');

      // For variable products, fetch their variations
      const normalizedProducts: NormalizedProduct[] = [];

      for (const product of products) {
        const normalized = await this.normalizeProduct(product);
        normalizedProducts.push(normalized);
      }

      logger.info(
        `Fetched ${normalizedProducts.length} products from WooCommerce`
      );
      return normalizedProducts;
    } catch (error) {
      logger.error('Error fetching products from WooCommerce:', error);
      throw new AppError(`Failed to fetch products: ${error}`, 500);
    }
  }

  async getProduct(
    _storeIdentifier: string,
    productId: string
  ): Promise<NormalizedProduct | null> {
    try {
      // Extract WooCommerce ID from normalized ID if needed
      const wooId = this.extractWooId(productId);

      const product = await this.client.request<WooProduct>(
        `/products/${wooId}`
      );
      return this.normalizeProduct(product);
    } catch (error) {
      if ((error as Error).message?.includes('404')) {
        return null;
      }
      logger.error('Error fetching product from WooCommerce:', error);
      throw new AppError(`Failed to fetch product: ${error}`, 500);
    }
  }

  async searchProducts(
    _storeIdentifier: string,
    filters: ProductSearchFilters
  ): Promise<NormalizedProduct[]> {
    try {
      const params = new URLSearchParams();

      if (filters.query) {
        params.append('search', filters.query);
      }

      if (filters.availability !== undefined) {
        params.append(
          'stock_status',
          filters.availability ? 'instock' : 'outofstock'
        );
      }

      if (filters.priceRange?.min !== undefined) {
        params.append('min_price', filters.priceRange.min.toString());
      }

      if (filters.priceRange?.max !== undefined) {
        params.append('max_price', filters.priceRange.max.toString());
      }

      if (filters.tags && filters.tags.length > 0) {
        // WooCommerce expects tag slugs, but we'll search by name
        params.append('tag', filters.tags.join(','));
      }

      // Sorting
      if (filters.sortKey) {
        const sortMapping: Record<string, { orderby: string; order: string }> =
          {
            created_at: { orderby: 'date', order: 'desc' },
            updated_at: { orderby: 'modified', order: 'desc' },
            title: { orderby: 'title', order: 'asc' },
            price: { orderby: 'price', order: 'asc' },
            best_selling: { orderby: 'popularity', order: 'desc' },
            relevance: { orderby: 'relevance', order: 'desc' },
          };

        const sort = sortMapping[filters.sortKey] || sortMapping.relevance;
        params.append('orderby', sort.orderby);
        params.append(
          'order',
          filters.reverse
            ? sort.order === 'desc'
              ? 'asc'
              : 'desc'
            : sort.order
        );
      }

      if (filters.limit) {
        params.append('per_page', Math.min(filters.limit, 100).toString());
      }

      const endpoint = `/products?${params.toString()}`;
      const products = await this.client.request<WooProduct[]>(endpoint);

      const normalizedProducts: NormalizedProduct[] = [];
      for (const product of products) {
        normalizedProducts.push(await this.normalizeProduct(product));
      }

      return normalizedProducts;
    } catch (error) {
      logger.error('Error searching products in WooCommerce:', error);
      throw new AppError(`Failed to search products: ${error}`, 500);
    }
  }

  async getProductRecommendations(
    storeIdentifier: string,
    options: RecommendationOptions
  ): Promise<NormalizedProductRecommendation[]> {
    try {
      if (options.productId) {
        const wooId = this.extractWooId(options.productId);
        const product = await this.client.request<WooProduct>(
          `/products/${wooId}`
        );

        let relatedIds: number[] = [];

        switch (options.intent) {
          case 'upsell':
            relatedIds = product.upsell_ids;
            break;
          case 'complementary':
            relatedIds = product.cross_sell_ids;
            break;
          case 'related':
          default:
            relatedIds = product.related_ids;
            break;
        }

        // Limit and filter
        const limit = options.limit || 5;
        const excludeIds =
          options.excludeProductIds?.map(id => this.extractWooId(id)) || [];
        relatedIds = relatedIds
          .filter(id => !excludeIds.includes(id.toString()))
          .slice(0, limit);

        // Fetch related products
        const recommendations: NormalizedProductRecommendation[] = [];
        for (const relatedId of relatedIds) {
          try {
            const relatedProduct = await this.client.request<WooProduct>(
              `/products/${relatedId}`
            );
            const normalized = await this.normalizeProduct(relatedProduct);
            recommendations.push({
              ...normalized,
              score: 100 - recommendations.length * 10,
              reason: this.getRecommendationReason(options.intent || 'related'),
            });
          } catch {
            // Skip products that can't be fetched
          }
        }

        return recommendations;
      } else {
        // Get popular products
        const products = await this.searchProducts(storeIdentifier, {
          sortKey: 'best_selling',
          limit: options.limit || 5,
          availability: true,
        });

        return products.map((product, index) => ({
          ...product,
          score: 100 - index * 10,
          reason: 'Popular product',
        }));
      }
    } catch (error) {
      logger.error('Error getting recommendations from WooCommerce:', error);
      throw new AppError(`Failed to get recommendations: ${error}`, 500);
    }
  }

  // ==================== Cart Operations ====================

  getCartProvider(): ICartProvider {
    return this.cartProvider;
  }

  // ==================== Webhook Operations ====================

  async createWebhooks(
    _storeIdentifier: string,
    topics?: WebhookTopic[]
  ): Promise<NormalizedWebhook[]> {
    const webhookTopics = topics || [
      'product.created',
      'product.updated',
      'product.deleted',
      'order.created',
    ];

    const createdWebhooks: NormalizedWebhook[] = [];

    for (const topic of webhookTopics) {
      try {
        const wooTopic = this.mapTopicToWoo(topic);
        if (!wooTopic) continue;

        const webhook = await this.client.request<WooWebhook>(
          '/webhooks',
          'POST',
          {
            name: `Kova Agent - ${topic}`,
            topic: wooTopic,
            delivery_url: `${process.env.APP_URL || 'https://api.kova.ai'}/api/woo/webhooks/${topic.replace('.', '/')}`,
            secret:
              this.credentials.webhookSecret ||
              crypto.randomBytes(32).toString('hex'),
            status: 'active',
          }
        );

        createdWebhooks.push(this.normalizeWebhook(webhook));
        logger.info(`Created WooCommerce webhook: ${topic}`);
      } catch (error) {
        logger.error(`Failed to create webhook ${topic}:`, error);
      }
    }

    return createdWebhooks;
  }

  async listWebhooks(_storeIdentifier: string): Promise<NormalizedWebhook[]> {
    try {
      const webhooks = await this.client.request<WooWebhook[]>('/webhooks');
      return webhooks.map(webhook => this.normalizeWebhook(webhook));
    } catch (error) {
      logger.error('Error listing webhooks:', error);
      throw new AppError(`Failed to list webhooks: ${error}`, 500);
    }
  }

  async deleteWebhook(
    _storeIdentifier: string,
    webhookId: string
  ): Promise<void> {
    try {
      await this.client.request(`/webhooks/${webhookId}?force=true`, 'DELETE');
      logger.info(`Deleted WooCommerce webhook: ${webhookId}`);
    } catch (error) {
      logger.error('Error deleting webhook:', error);
      throw new AppError(`Failed to delete webhook: ${error}`, 500);
    }
  }

  verifyWebhook(payload: string, signature: string): boolean {
    if (!this.credentials.webhookSecret) {
      logger.warn('Webhook secret not configured - skipping verification');
      return true;
    }

    const calculatedSignature = crypto
      .createHmac('sha256', this.credentials.webhookSecret)
      .update(payload, 'utf8')
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature),
      Buffer.from(signature)
    );
  }

  // ==================== Order Operations ====================

  async getOrdersByDateRange(
    _storeIdentifier: string,
    startDate: string,
    endDate: string
  ): Promise<NormalizedOrder[]> {
    try {
      const params = new URLSearchParams({
        after: startDate,
        before: endDate,
        per_page: '100',
      });

      const orders = await this.client.getAllPaginated<WooOrder>(
        `/orders?${params.toString()}`
      );
      return orders.map(order => this.normalizeOrder(order));
    } catch (error) {
      logger.error('Error fetching orders from WooCommerce:', error);
      throw new AppError(`Failed to fetch orders: ${error}`, 500);
    }
  }

  async getOrder(
    _storeIdentifier: string,
    orderId: string
  ): Promise<NormalizedOrder | null> {
    try {
      const wooId = this.extractWooId(orderId);
      const order = await this.client.request<WooOrder>(`/orders/${wooId}`);
      return this.normalizeOrder(order);
    } catch (error) {
      if ((error as Error).message?.includes('404')) {
        return null;
      }
      logger.error('Error fetching order from WooCommerce:', error);
      throw new AppError(`Failed to fetch order: ${error}`, 500);
    }
  }

  // ==================== Store Operations ====================

  async getStoreInfo(
    _storeIdentifier: string
  ): Promise<NormalizedStore | null> {
    try {
      // Fetch settings and test connection
      await this.client.request<Array<{ id: string; value: unknown }>>(
        '/settings/general'
      );
      const storeInfo = await this.testConnection();

      if (!storeInfo.success) {
        return null;
      }

      return {
        id: generateNormalizedId('woocommerce', this.credentials.siteUrl),
        platform: 'woocommerce',
        identifier: this.credentials.siteUrl,
        name: storeInfo.storeName,
        currency: storeInfo.currency || 'USD',
      };
    } catch (error) {
      logger.error('Error fetching store info from WooCommerce:', error);
      return null;
    }
  }

  async validateConnection(_storeIdentifier: string): Promise<boolean> {
    const result = await this.testConnection();
    return result.success;
  }

  /**
   * Test connection to WooCommerce store
   */
  async testConnection(): Promise<WooConnectionTestResult> {
    try {
      const systemStatus = await this.client.request<{
        environment: {
          site_url: string;
          version: string;
        };
        settings: {
          currency: string;
          currency_symbol: string;
        };
      }>('/system_status');

      return {
        success: true,
        storeName: new URL(this.credentials.siteUrl).hostname,
        storeUrl: systemStatus.environment.site_url,
        woocommerceVersion: systemStatus.environment.version,
        currency: systemStatus.settings.currency,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Normalize WooCommerce product to platform-agnostic format
   */
  private async normalizeProduct(
    product: WooProduct
  ): Promise<NormalizedProduct> {
    const normalizedId = generateNormalizedId('woocommerce', product.id);

    // Fetch variations for variable products
    let variants: NormalizedProduct['variants'] = [];

    if (product.type === 'variable' && product.variations.length > 0) {
      try {
        const variations = await this.client.request<WooProductVariation[]>(
          `/products/${product.id}/variations`
        );
        variants = variations.map(variation =>
          this.normalizeVariation(variation, normalizedId)
        );
      } catch {
        logger.warn(`Failed to fetch variations for product ${product.id}`);
      }
    }

    // If no variations (simple product), create a default variant
    if (variants.length === 0) {
      variants = [
        {
          id: generateVariantId('woocommerce', product.id),
          external_id: product.id.toString(),
          product_id: normalizedId,
          title: 'Default',
          sku: product.sku,
          price: product.price,
          compare_at_price: product.sale_price
            ? product.regular_price
            : undefined,
          inventory_quantity: product.stock_quantity || 0,
          weight: product.weight ? parseFloat(product.weight) : undefined,
          requires_shipping: product.shipping_required,
          taxable: product.tax_status === 'taxable',
          available: product.purchasable && product.stock_status === 'instock',
        },
      ];
    }

    return {
      id: normalizedId,
      external_id: product.id.toString(),
      platform: 'woocommerce',
      title: product.name,
      description: product.description || product.short_description || '',
      handle: product.slug,
      vendor: undefined, // WooCommerce doesn't have vendor by default
      product_type: product.categories[0]?.name,
      tags: product.tags.map(tag => tag.name),
      status: this.mapStatus(product.status),
      images: product.images.map(img => ({
        id: img.id.toString(),
        src: img.src,
        alt_text: img.alt,
        position: img.position,
      })),
      variants,
      created_at: product.date_created,
      updated_at: product.date_modified,
      price_range: {
        min: product.price,
        max: product.price,
        currency: 'USD', // Will be set from store settings
      },
    };
  }

  /**
   * Normalize WooCommerce variation
   */
  private normalizeVariation(
    variation: WooProductVariation,
    productId: string
  ): NormalizedProduct['variants'][0] {
    return {
      id: generateVariantId('woocommerce', variation.id),
      external_id: variation.id.toString(),
      product_id: productId,
      title: variation.attributes.map(a => a.option).join(' / ') || 'Default',
      sku: variation.sku,
      price: variation.price,
      compare_at_price: variation.sale_price
        ? variation.regular_price
        : undefined,
      inventory_quantity: variation.stock_quantity || 0,
      weight: variation.weight ? parseFloat(variation.weight) : undefined,
      requires_shipping: true,
      taxable: true,
      available: variation.purchasable && variation.stock_status === 'instock',
      options: variation.attributes.map(attr => ({
        name: attr.name,
        value: attr.option,
      })),
      image: variation.image
        ? {
            id: variation.image.id.toString(),
            src: variation.image.src,
            alt_text: variation.image.alt,
          }
        : undefined,
    };
  }

  /**
   * Normalize WooCommerce order
   */
  private normalizeOrder(order: WooOrder): NormalizedOrder {
    return {
      id: generateNormalizedId('woocommerce', order.id),
      external_id: order.id.toString(),
      platform: 'woocommerce',
      order_number: order.number,
      status: order.status,
      financial_status: order.date_paid ? 'paid' : 'pending',
      created_at: order.date_created,
      updated_at: order.date_modified,
      currency: order.currency,
      subtotal: (
        parseFloat(order.total) -
        parseFloat(order.total_tax) -
        parseFloat(order.shipping_total)
      ).toString(),
      total_tax: order.total_tax,
      total_shipping: order.shipping_total,
      total_discount: order.discount_total,
      total: order.total,
      line_items: order.line_items.map(item => ({
        id: item.id.toString(),
        product_id: generateNormalizedId('woocommerce', item.product_id),
        product_external_id: item.product_id.toString(),
        product_title: item.name,
        variant_id: generateVariantId(
          'woocommerce',
          item.variation_id || item.product_id
        ),
        variant_external_id: (item.variation_id || item.product_id).toString(),
        variant_title: item.name,
        quantity: item.quantity,
        price: item.price.toString(),
        total: item.total,
        currency: order.currency,
        sku: item.sku,
      })),
      customer: order.customer_id
        ? {
            id: order.customer_id.toString(),
            email: order.billing.email,
            first_name: order.billing.first_name,
            last_name: order.billing.last_name,
            phone: order.billing.phone,
          }
        : undefined,
      shipping_address: {
        address1: order.shipping.address_1,
        address2: order.shipping.address_2,
        city: order.shipping.city,
        province: order.shipping.state,
        country: order.shipping.country,
        zip: order.shipping.postcode,
      },
      note: order.customer_note,
    };
  }

  /**
   * Normalize WooCommerce webhook
   */
  private normalizeWebhook(webhook: WooWebhook): NormalizedWebhook {
    return {
      id: webhook.id.toString(),
      topic: this.mapWooTopicToNormalized(webhook.topic),
      callback_url: webhook.delivery_url,
      created_at: webhook.date_created,
      updated_at: webhook.date_modified,
    };
  }

  /**
   * Map WooCommerce status to normalized status
   */
  private mapStatus(status: string): 'active' | 'draft' | 'archived' {
    switch (status) {
      case 'publish':
        return 'active';
      case 'draft':
      case 'pending':
        return 'draft';
      case 'private':
      default:
        return 'archived';
    }
  }

  /**
   * Map normalized topic to WooCommerce topic
   */
  private mapTopicToWoo(topic: WebhookTopic): string | null {
    const mapping: Record<string, string> = {
      'product.created': 'product.created',
      'product.updated': 'product.updated',
      'product.deleted': 'product.deleted',
      'order.created': 'order.created',
      'order.updated': 'order.updated',
      'customer.created': 'customer.created',
      'customer.updated': 'customer.updated',
    };
    return mapping[topic] || null;
  }

  /**
   * Map WooCommerce topic to normalized topic
   */
  private mapWooTopicToNormalized(wooTopic: string): WebhookTopic {
    return wooTopic as WebhookTopic;
  }

  /**
   * Get recommendation reason text
   */
  private getRecommendationReason(intent: string): string {
    switch (intent) {
      case 'upsell':
        return 'Upgrade your purchase';
      case 'complementary':
        return 'Frequently bought together';
      case 'related':
      default:
        return 'You might also like';
    }
  }

  /**
   * Extract WooCommerce ID from normalized ID
   */
  private extractWooId(normalizedOrRawId: string): string {
    // If it's already a number string, return it
    if (/^\d+$/.test(normalizedOrRawId)) {
      return normalizedOrRawId;
    }

    // Try to extract from normalized format
    const match = normalizedOrRawId.match(/^woocommerce-(?:var-)?(\d+)$/);
    if (match) {
      return match[1];
    }

    // Return as-is if no match
    return normalizedOrRawId;
  }
}
