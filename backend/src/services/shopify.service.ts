import { adminApiClient, storefrontApiClient } from '@shopify/admin-api-client';
import { createStorefrontApiClient } from '@shopify/storefront-api-client';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';
import { ShopifyProduct, ShopifyCart, AppError } from '@/types';
import crypto from 'crypto';

export class ShopifyService {
  private adminClients: Map<string, any> = new Map();
  private storefrontClients: Map<string, any> = new Map();

  constructor() {}

  getAdminClient(shop: string, accessToken: string) {
    const key = `${shop}-${accessToken}`;
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

  getStorefrontClient(shop: string, accessToken: string) {
    const key = `${shop}-${accessToken}`;
    if (!this.storefrontClients.has(key)) {
      const client = createStorefrontApiClient({
        storeDomain: shop,
        apiVersion: '2024-10',
        publicAccessToken: accessToken, // This should be storefront access token
      });
      this.storefrontClients.set(key, client);
    }
    return this.storefrontClients.get(key);
  }

  async getAllProducts(
    shop: string,
    accessToken: string
  ): Promise<ShopifyProduct[]> {
    const client = this.getAdminClient(shop, accessToken);
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
      throw new AppError(`Failed to fetch products: ${error}`, 500);
    }
  }

  async getProduct(
    shop: string,
    accessToken: string,
    productId: string
  ): Promise<ShopifyProduct | null> {
    const client = this.getAdminClient(shop, accessToken);

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
        })),
        created_at: product.createdAt,
        updated_at: product.updatedAt,
      };
    } catch (error) {
      logger.error('Error fetching product from Shopify:', error);
      throw new AppError(`Failed to fetch product: ${error}`, 500);
    }
  }

  async createCart(
    shop: string,
    storefrontToken: string
  ): Promise<ShopifyCart> {
    const client = this.getStorefrontClient(shop, storefrontToken);

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
      throw new AppError(`Failed to create cart: ${error}`, 500);
    }
  }

  async addToCart(
    shop: string,
    storefrontToken: string,
    cartId: string,
    lines: Array<{ merchandiseId: string; quantity: number }>
  ): Promise<ShopifyCart> {
    const client = this.getStorefrontClient(shop, storefrontToken);

    try {
      const query = `
        mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
          cartLinesAdd(cartId: $cartId, lines: $lines) {
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

      const response = await client.request(query, {
        variables: {
          cartId,
          lines: lines.map(line => ({
            merchandiseId: line.merchandiseId,
            quantity: line.quantity,
          })),
        },
      });

      if (response.data?.cartLinesAdd?.userErrors?.length > 0) {
        throw new AppError(
          `Add to cart failed: ${response.data.cartLinesAdd.userErrors[0].message}`,
          400
        );
      }

      return response.data.cartLinesAdd.cart;
    } catch (error) {
      logger.error('Error adding to cart:', error);
      throw new AppError(`Failed to add to cart: ${error}`, 500);
    }
  }

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
      throw new AppError(`Failed to exchange code for token: ${error}`, 500);
    }
  }
}
