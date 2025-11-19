import { adminApiClient, storefrontApiClient } from '@shopify/admin-api-client';
import { createStorefrontApiClient } from '@shopify/storefront-api-client';
import { SupabaseService } from '@/services/supabase.service';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';
import { ShopifyProduct, ShopifyCart, AppError } from '@/types';
import crypto from 'crypto';

/**
 * Modern Shopify Service with Session Token Support
 * Automatically handles token retrieval for authenticated requests
 */
export class ModernShopifyService {
  private adminClients: Map<string, any> = new Map();
  private storefrontClients: Map<string, any> = new Map();
  private supabaseService: SupabaseService;

  constructor() {
    this.supabaseService = new SupabaseService();
  }

  /**
   * Get Admin API client with automatic token retrieval
   */
  async getAdminClient(shop: string, accessToken?: string) {
    // If token is provided, use it directly
    if (accessToken) {
      return this.createAdminClient(shop, accessToken);
    }

    // Otherwise, retrieve offline token from database
    const session = await this.supabaseService.getOfflineSession(shop);
    if (!session || !session.access_token) {
      throw new AppError(`No offline access token available for shop: ${shop}`, 401);
    }

    return this.createAdminClient(shop, session.access_token);
  }

  /**
   * Get Storefront API client
   */
  async getStorefrontClient(shop: string, storefrontToken?: string) {
    // For Storefront API, we need a public access token
    // This should be configured separately from admin tokens
    if (!storefrontToken) {
      throw new AppError('Storefront access token is required for Storefront API calls', 400);
    }

    const key = `storefront-${shop}-${storefrontToken}`;
    if (!this.storefrontClients.has(key)) {
      const client = createStorefrontApiClient({
        storeDomain: shop,
        apiVersion: '2024-10',
        publicAccessToken: storefrontToken,
      });
      this.storefrontClients.set(key, client);
    }
    return this.storefrontClients.get(key);
  }

  private createAdminClient(shop: string, accessToken: string) {
    const key = `admin-${shop}-${accessToken}`;
    if (!this.adminClients.has(key)) {
      const client = adminApiClient({
        storeDomain: shop,
        apiVersion: '2024-10',
        accessToken: accessToken,
      });
      this.adminClients.set(key, client);
    }
    return this.adminClients.get(key);
  }

  /**
   * Validate if access token is still valid
   */
  async validateAccessToken(shop: string, accessToken: string): Promise<boolean> {
    try {
      const client = this.createAdminClient(shop, accessToken);
      
      // Simple query to test token validity
      const query = `
        query {
          shop {
            id
            name
          }
        }
      `;

      const response = await client.request(query);
      return !!response.data?.shop;
    } catch (error) {
      logger.warn(`Access token validation failed for ${shop}:`, error.message);
      return false;
    }
  }

  /**
   * Get all products with automatic token handling
   */
  async getAllProducts(shop: string, accessToken?: string): Promise<ShopifyProduct[]> {
    const client = await this.getAdminClient(shop, accessToken);
    const products: ShopifyProduct[] = [];
    let cursor = null;

    try {
      do {
        const query = `
          query GetProducts($first: Int!, $after: String) {
            products(first: $first, after: $after) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                id
                title
                description
                handle
                vendor
                productType
                tags
                status
                images(first: 10) {
                  nodes {
                    id
                    url
                    altText
                    width
                    height
                  }
                }
                variants(first: 100) {
                  nodes {
                    id
                    title
                    sku
                    price
                    compareAtPrice
                    inventoryQuantity
                    weight
                    weightUnit
                    requiresShipping
                    taxable
                    availableForSale
                    selectedOptions {
                      name
                      value
                    }
                  }
                }
                createdAt
                updatedAt
              }
            }
          }
        `;

        const variables = {
          first: 50,
          after: cursor,
        };

        const response = await client.request(query, { variables });

        if (response.data?.products?.nodes) {
          const mappedProducts = response.data.products.nodes.map(
            (product: any) => ({
              id: product.id,
              title: product.title,
              description: product.description || '',
              handle: product.handle,
              vendor: product.vendor,
              product_type: product.productType,
              tags: product.tags,
              status: product.status,
              images: product.images.nodes.map((img: any) => ({
                id: img.id,
                src: img.url,
                alt_text: img.altText,
                width: img.width,
                height: img.height,
              })),
              variants: product.variants.nodes.map((variant: any) => ({
                id: variant.id,
                product_id: product.id,
                title: variant.title,
                sku: variant.sku,
                price: variant.price,
                compare_at_price: variant.compareAtPrice,
                inventory_quantity: variant.inventoryQuantity || 0,
                weight: variant.weight || 0,
                weight_unit: variant.weightUnit || 'kg',
                requires_shipping: variant.requiresShipping,
                taxable: variant.taxable,
                available_for_sale: variant.availableForSale,
                selected_options: variant.selectedOptions,
              })),
              created_at: product.createdAt,
              updated_at: product.updatedAt,
            })
          );

          products.push(...mappedProducts);
        }

        cursor = response.data?.products?.pageInfo?.hasNextPage
          ? response.data.products.pageInfo.endCursor
          : null;
      } while (cursor);

      logger.info(`Fetched ${products.length} products from ${shop}`);
      return products;
    } catch (error) {
      logger.error('Error fetching products from Shopify:', error);
      throw new AppError(`Failed to fetch products: ${error.message}`, 500);
    }
  }

  /**
   * Get single product with automatic token handling
   */
  async getProduct(shop: string, productId: string, accessToken?: string): Promise<ShopifyProduct | null> {
    const client = await this.getAdminClient(shop, accessToken);

    try {
      const query = `
        query GetProduct($id: ID!) {
          product(id: $id) {
            id
            title
            description
            handle
            vendor
            productType
            tags
            status
            images(first: 10) {
              nodes {
                id
                url
                altText
                width
                height
              }
            }
            variants(first: 100) {
              nodes {
                id
                title
                sku
                price
                compareAtPrice
                inventoryQuantity
                weight
                weightUnit
                requiresShipping
                taxable
                availableForSale
                selectedOptions {
                  name
                  value
                }
              }
            }
            createdAt
            updatedAt
          }
        }
      `;

      const response = await client.request(query, {
        variables: { id: productId },
      });

      if (!response.data?.product) {
        return null;
      }

      const product = response.data.product;
      return {
        id: product.id,
        title: product.title,
        description: product.description || '',
        handle: product.handle,
        vendor: product.vendor,
        product_type: product.productType,
        tags: product.tags,
        status: product.status,
        images: product.images.nodes.map((img: any) => ({
          id: img.id,
          src: img.url,
          alt_text: img.altText,
          width: img.width,
          height: img.height,
        })),
        variants: product.variants.nodes.map((variant: any) => ({
          id: variant.id,
          product_id: product.id,
          title: variant.title,
          sku: variant.sku,
          price: variant.price,
          compare_at_price: variant.compareAtPrice,
          inventory_quantity: variant.inventoryQuantity || 0,
          weight: variant.weight || 0,
          weight_unit: variant.weightUnit || 'kg',
          requires_shipping: variant.requiresShipping,
          taxable: variant.taxable,
          available_for_sale: variant.availableForSale,
          selected_options: variant.selectedOptions,
        })),
        created_at: product.createdAt,
        updated_at: product.updatedAt,
      };
    } catch (error) {
      logger.error('Error fetching product from Shopify:', error);
      throw new AppError(`Failed to fetch product: ${error.message}`, 500);
    }
  }

  /**
   * Get shop information
   */
  async getShopInfo(shop: string, accessToken?: string): Promise<any> {
    const client = await this.getAdminClient(shop, accessToken);

    try {
      const query = `
        query {
          shop {
            id
            name
            email
            domain
            myshopifyDomain
            plan {
              displayName
              partnerDevelopment
              shopifyPlus
            }
            primaryDomain {
              host
              sslEnabled
            }
            currencyCode
            timezoneAbbreviation
            timezoneOffsetMinutes
          }
        }
      `;

      const response = await client.request(query);
      return response.data?.shop;
    } catch (error) {
      logger.error('Error fetching shop info:', error);
      throw new AppError(`Failed to fetch shop info: ${error.message}`, 500);
    }
  }

  /**
   * Create cart using Storefront API
   */
  async createCart(shop: string, storefrontToken: string): Promise<ShopifyCart> {
    const client = await this.getStorefrontClient(shop, storefrontToken);

    try {
      const query = `
        mutation cartCreate {
          cartCreate {
            cart {
              id
              lines(first: 100) {
                nodes {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      selectedOptions {
                        name
                        value
                      }
                      product {
                        id
                        title
                        handle
                      }
                    }
                  }
                }
              }
              cost {
                totalAmount {
                  amount
                  currencyCode
                }
                subtotalAmount {
                  amount
                  currencyCode
                }
              }
              totalQuantity
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const response = await client.request(query);

      if (response.data?.cartCreate?.userErrors?.length > 0) {
        throw new AppError(
          `Cart creation failed: ${response.data.cartCreate.userErrors[0].message}`,
          400
        );
      }

      return response.data.cartCreate.cart;
    } catch (error) {
      logger.error('Error creating cart:', error);
      throw new AppError(`Failed to create cart: ${error.message}`, 500);
    }
  }

  /**
   * Create webhooks with automatic token handling
   */
  async createWebhooks(shop: string, accessToken?: string): Promise<void> {
    const client = await this.getAdminClient(shop, accessToken);
    
    const webhooks = [
      {
        topic: 'PRODUCTS_CREATE',
        endpoint: `${config.shopify.appUrl}/api/webhooks/products/create`,
        format: 'JSON'
      },
      {
        topic: 'PRODUCTS_UPDATE', 
        endpoint: `${config.shopify.appUrl}/api/webhooks/products/update`,
        format: 'JSON'
      },
      {
        topic: 'PRODUCTS_DELETE',
        endpoint: `${config.shopify.appUrl}/api/webhooks/products/delete`, 
        format: 'JSON'
      },
      {
        topic: 'APP_UNINSTALLED',
        endpoint: `${config.shopify.appUrl}/api/webhooks/app/uninstalled`,
        format: 'JSON'
      }
    ];

    for (const webhook of webhooks) {
      try {
        await this.createWebhook(client, webhook.topic, webhook.endpoint, webhook.format);
        logger.info(`Created webhook: ${webhook.topic} for shop: ${shop}`);
      } catch (error) {
        logger.error(`Failed to create webhook ${webhook.topic}:`, error);
      }
    }
  }

  private async createWebhook(
    client: any,
    topic: string,
    address: string,
    format: string = 'JSON'
  ): Promise<any> {
    const mutation = `
      mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
          webhookSubscription {
            id
            callbackUrl
            topic
            format
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      topic,
      webhookSubscription: {
        callbackUrl: address,
        format: format.toUpperCase()
      }
    };

    const response = await client.request(mutation, { variables });
    
    if (response.data?.webhookSubscriptionCreate?.userErrors?.length > 0) {
      const errors = response.data.webhookSubscriptionCreate.userErrors;
      throw new Error(`Webhook creation failed: ${errors[0].message}`);
    }

    return response.data.webhookSubscriptionCreate.webhookSubscription;
  }

  /**
   * Verify webhook signatures
   */
  verifyWebhook(data: string, hmacHeader: string): boolean {
    const calculatedHmac = crypto
      .createHmac('sha256', config.shopify.webhookSecret)
      .update(data, 'utf8')
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(calculatedHmac),
      Buffer.from(hmacHeader)
    );
  }

  /**
   * Generate install URL (OAuth flow)
   */
  generateInstallUrl(shop: string, redirectUri: string): string {
    const scopes = config.shopify.scopes;
    const state = crypto.randomBytes(16).toString('hex');

    const params = new URLSearchParams({
      client_id: config.shopify.apiKey,
      scope: scopes,
      redirect_uri: redirectUri,
      state: state,
    });

    return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token (OAuth flow)
   */
  async exchangeCodeForToken(shop: string, code: string): Promise<string> {
    try {
      const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: config.shopify.apiKey,
          client_secret: config.shopify.apiSecret,
          code: code,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return (data as any).access_token;
    } catch (error) {
      logger.error('Error exchanging code for token:', error);
      throw new AppError(`Failed to exchange code for token: ${error.message}`, 500);
    }
  }
}