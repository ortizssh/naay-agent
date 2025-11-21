import { adminApiClient, storefrontApiClient } from '@shopify/admin-api-client';
import { createStorefrontApiClient } from '@shopify/storefront-api-client';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';
import { ShopifyProduct, ShopifyCart, ShopifyVariant, AppError, ProductSearchFilters } from '@/types';
import crypto from 'crypto';


// Storefront API search interface
interface StorefrontSearchFilters {
  query: string;
  productFilters?: {
    available?: boolean;
    productType?: string;
    vendor?: string;
    variantOption?: {
      name: string;
      value: string;
    };
    price?: {
      min?: number;
      max?: number;
    };
  }[];
  sortKey?:
    | 'RELEVANCE'
    | 'BEST_SELLING'
    | 'CREATED_AT'
    | 'ID'
    | 'PRICE'
    | 'TITLE'
    | 'UPDATED_AT'
    | 'VENDOR';
  reverse?: boolean;
  first?: number;
}

// Product recommendation interface
interface ProductRecommendation extends ShopifyProduct {
  score?: number;
  reason?: string;
}

// Cart operations interface
interface CartLineInput {
  merchandiseId: string;
  quantity: number;
  attributes?: Array<{
    key: string;
    value: string;
  }>;
}

// Extended cart with checkout URL
interface ExtendedShopifyCart extends ShopifyCart {
  checkoutUrl?: string;
  note?: string;
  attributes?: Array<{
    key: string;
    value: string;
  }>;
  buyerIdentity?: {
    email?: string;
    phone?: string;
    customerAccessToken?: string;
  };
}

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

  async searchProducts(
    shop: string,
    accessToken: string,
    filters: ProductSearchFilters,
    useStorefront: boolean = false
  ): Promise<ShopifyProduct[]> {
    if (useStorefront) {
      return this.searchProductsStorefront(shop, accessToken, {
        query: filters.query || '',
        first: filters.limit || 10,
        sortKey: filters.sortKey === 'PRICE' ? 'PRICE' : 'RELEVANCE',
        reverse: filters.reverse,
        productFilters: [
          ...(filters.availability !== undefined
            ? [{ available: filters.availability }]
            : []),
          ...(filters.vendor ? [{ vendor: filters.vendor }] : []),
          ...(filters.productType
            ? [{ productType: filters.productType }]
            : []),
          ...(filters.priceRange ? [{ price: filters.priceRange }] : []),
        ],
      });
    }
    return this.searchProductsAdmin(shop, accessToken, filters);
  }

  private async searchProductsAdmin(
    shop: string,
    accessToken: string,
    filters: ProductSearchFilters
  ): Promise<ShopifyProduct[]> {
    const client = this.getAdminClient(shop, accessToken);
    const products: ShopifyProduct[] = [];
    let cursor = null;
    const limit = Math.min(filters.limit || 50, 250);

    try {
      // Build query string for Admin API
      let queryString = '';
      if (filters.query) {
        queryString += `title:*${filters.query}* OR description:*${filters.query}* OR tag:${filters.query}`;
      }
      if (filters.vendor) {
        queryString += queryString
          ? ` AND vendor:${filters.vendor}`
          : `vendor:${filters.vendor}`;
      }
      if (filters.productType) {
        queryString += queryString
          ? ` AND product_type:${filters.productType}`
          : `product_type:${filters.productType}`;
      }
      if (filters.tags && filters.tags.length > 0) {
        const tagQuery = filters.tags.map(tag => `tag:${tag}`).join(' OR ');
        queryString += queryString ? ` AND (${tagQuery})` : `(${tagQuery})`;
      }
      if (filters.availability !== undefined) {
        queryString += queryString
          ? ` AND available:${filters.availability}`
          : `available:${filters.availability}`;
      }

      do {
        const query = `
          query GetProducts($first: Int!, $after: String, $query: String, $sortKey: ProductSortKeys, $reverse: Boolean) {
            products(first: $first, after: $after, query: $query, sortKey: $sortKey, reverse: $reverse) {
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
                availableForSale
                totalInventory
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
                priceRange {
                  minVariantPrice {
                    amount
                    currencyCode
                  }
                  maxVariantPrice {
                    amount
                    currencyCode
                  }
                }
                createdAt
                updatedAt
              }
            }
          }
        `;

        const variables = {
          first: Math.min(limit - products.length, 50),
          after: cursor,
          query: queryString || null,
          sortKey: filters.sortKey || 'CREATED_AT',
          reverse: filters.reverse || false,
        };

        const response = await client.request(query, { variables });

        if (response.data?.products?.nodes) {
          const mappedProducts = response.data.products.nodes
            .filter((product: any) => {
              // Additional filtering for price range if specified
              if (filters.priceRange) {
                const minPrice = parseFloat(
                  product.priceRange.minVariantPrice.amount
                );
                const maxPrice = parseFloat(
                  product.priceRange.maxVariantPrice.amount
                );

                if (filters.priceRange.min && minPrice < filters.priceRange.min)
                  return false;
                if (filters.priceRange.max && maxPrice > filters.priceRange.max)
                  return false;
              }
              return true;
            })
            .map((product: any) => ({
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
              })),
              created_at: product.createdAt,
              updated_at: product.updatedAt,
            }));

          products.push(...mappedProducts);
        }

        cursor = response.data?.products?.pageInfo?.hasNextPage
          ? response.data.products.pageInfo.endCursor
          : null;
      } while (cursor && products.length < limit);

      logger.info(`Search found ${products.length} products from ${shop}`, {
        query: filters.query,
        filters: JSON.stringify(filters),
      });
      return products;
    } catch (error) {
      logger.error('Error searching products from Shopify:', error);
      throw new AppError(`Failed to search products: ${error}`, 500);
    }
  }

  private async searchProductsStorefront(
    shop: string,
    storefrontToken: string,
    filters: StorefrontSearchFilters
  ): Promise<ShopifyProduct[]> {
    const client = this.getStorefrontClient(shop, storefrontToken);

    try {
      const query = `
        query SearchProducts($query: String!, $first: Int!, $sortKey: SearchSortKeys, $reverse: Boolean, $productFilters: [ProductFilter!]) {
          search(query: $query, first: $first, sortKey: $sortKey, reverse: $reverse, productFilters: $productFilters) {
            nodes {
              ... on Product {
                id
                title
                description
                handle
                vendor
                productType
                tags
                availableForSale
                images(first: 5) {
                  nodes {
                    id
                    url
                    altText
                    width
                    height
                  }
                }
                variants(first: 20) {
                  nodes {
                    id
                    title
                    sku
                    price {
                      amount
                      currencyCode
                    }
                    compareAtPrice {
                      amount
                      currencyCode
                    }
                    availableForSale
                    selectedOptions {
                      name
                      value
                    }
                  }
                }
                priceRange {
                  minVariantPrice {
                    amount
                    currencyCode
                  }
                  maxVariantPrice {
                    amount
                    currencyCode
                  }
                }
                createdAt
                updatedAt
              }
            }
          }
        }
      `;

      const variables = {
        query: filters.query,
        first: filters.first || 10,
        sortKey: filters.sortKey || 'RELEVANCE',
        reverse: filters.reverse || false,
        productFilters: filters.productFilters || [],
      };

      const response = await client.request(query, { variables });

      if (!response.data?.search?.nodes) {
        return [];
      }

      const products = response.data.search.nodes.map((product: any) => ({
        id: product.id,
        title: product.title,
        description: product.description || '',
        handle: product.handle,
        vendor: product.vendor,
        product_type: product.productType,
        tags: product.tags,
        status: product.availableForSale ? 'active' : 'draft',
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
          price: variant.price.amount,
          compare_at_price: variant.compareAtPrice?.amount,
          inventory_quantity: variant.availableForSale ? 1 : 0, // Storefront doesn't expose inventory
          weight: 0,
          weight_unit: 'kg',
          requires_shipping: true,
          taxable: true,
        })),
        created_at: product.createdAt,
        updated_at: product.updatedAt,
      }));

      return products;
    } catch (error) {
      logger.error('Error searching products via Storefront API:', error);
      throw new AppError(`Failed to search products: ${error}`, 500);
    }
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

  async getProductRecommendations(
    shop: string,
    accessToken: string,
    options: {
      productId?: string;
      intent?: 'related' | 'complementary' | 'upsell' | 'popular';
      limit?: number;
    }
  ): Promise<ProductRecommendation[]> {
    try {
      // For now, we'll use a simple approach based on tags and product type
      // In a production environment, you'd want to implement more sophisticated ML-based recommendations

      if (options.productId) {
        // Get the base product to find related items
        const baseProduct = await this.getProduct(
          shop,
          accessToken,
          options.productId
        );
        if (!baseProduct) {
          throw new AppError('Base product not found for recommendations', 404);
        }

        // Find products with similar tags or same product type
        const filters: ProductSearchFilters = {
          limit: (options.limit || 5) * 2, // Get more to filter later
        };

        if (options.intent === 'related') {
          filters.productType = baseProduct.product_type;
        } else if (
          options.intent === 'complementary' &&
          baseProduct.tags.length > 0
        ) {
          filters.tags = baseProduct.tags.slice(0, 3); // Use first 3 tags
        }

        const products = await this.searchProductsAdmin(
          shop,
          accessToken,
          filters
        );

        // Filter out the base product and score by relevance
        const recommendations = products
          .filter(p => p.id !== baseProduct.id)
          .map(product => {
            let score = 0;

            // Score based on shared tags
            const sharedTags = baseProduct.tags.filter(tag =>
              product.tags.includes(tag)
            );
            score += sharedTags.length * 10;

            // Score based on same product type
            if (product.product_type === baseProduct.product_type) {
              score += 20;
            }

            // Score based on same vendor
            if (product.vendor === baseProduct.vendor) {
              score += 15;
            }

            return {
              ...product,
              score,
              reason: this.getRecommendationReason(
                sharedTags,
                product,
                baseProduct
              ),
            };
          })
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .slice(0, options.limit || 5);

        return recommendations;
      } else {
        // Get popular products (highest inventory or most recent)
        const products = await this.searchProductsAdmin(shop, accessToken, {
          sortKey: 'CREATED_AT',
          reverse: true,
          limit: options.limit || 5,
          availability: true,
        });

        return products.map(product => ({
          ...product,
          score: 100,
          reason: 'Popular product',
        }));
      }
    } catch (error) {
      logger.error('Error getting product recommendations:', error);
      throw new AppError(`Failed to get recommendations: ${error}`, 500);
    }
  }

  private getRecommendationReason(
    sharedTags: string[],
    product: ShopifyProduct,
    baseProduct: ShopifyProduct
  ): string {
    if (sharedTags.length > 2) {
      return `Similar style (${sharedTags.slice(0, 2).join(', ')})`;
    } else if (product.product_type === baseProduct.product_type) {
      return `Same category (${product.product_type})`;
    } else if (product.vendor === baseProduct.vendor) {
      return `Same brand (${product.vendor})`;
    }
    return 'You might also like';
  }

  async createCart(
    shop: string,
    storefrontToken: string,
    buyerIdentity?: {
      email?: string;
      phone?: string;
      customerAccessToken?: string;
    }
  ): Promise<ExtendedShopifyCart> {
    const client = this.getStorefrontClient(shop, storefrontToken);

    try {
      const query = `
        mutation cartCreate($input: CartInput) {
          cartCreate(input: $input) {
            cart {
              id
              checkoutUrl
              lines(first: 100) {
                nodes {
                  id
                  quantity
                  attributes {
                    key
                    value
                  }
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price {
                        amount
                        currencyCode
                      }
                      selectedOptions {
                        name
                        value
                      }
                      product {
                        id
                        title
                        handle
                        images(first: 1) {
                          nodes {
                            url
                            altText
                          }
                        }
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
                totalTaxAmount {
                  amount
                  currencyCode
                }
              }
              totalQuantity
              note
              attributes {
                key
                value
              }
              buyerIdentity {
                email
                phone
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variables = buyerIdentity ? { input: { buyerIdentity } } : {};
      const response = await client.request(query, { variables });

      if (response.data?.cartCreate?.userErrors?.length > 0) {
        throw new AppError(
          `Cart creation failed: ${response.data.cartCreate.userErrors[0].message}`,
          400
        );
      }

      const cart = response.data.cartCreate.cart;
      return {
        ...cart,
        lines: cart.lines.nodes,
        checkoutUrl: cart.checkoutUrl,
        note: cart.note,
        attributes: cart.attributes,
        buyerIdentity: cart.buyerIdentity,
      };
    } catch (error) {
      logger.error('Error creating cart:', error);
      throw new AppError(`Failed to create cart: ${error}`, 500);
    }
  }

  async addToCart(
    shop: string,
    storefrontToken: string,
    cartId: string,
    lines: CartLineInput[]
  ): Promise<ExtendedShopifyCart> {
    const client = this.getStorefrontClient(shop, storefrontToken);

    try {
      const query = `
        mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
          cartLinesAdd(cartId: $cartId, lines: $lines) {
            cart {
              id
              checkoutUrl
              lines(first: 100) {
                nodes {
                  id
                  quantity
                  attributes {
                    key
                    value
                  }
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price {
                        amount
                        currencyCode
                      }
                      selectedOptions {
                        name
                        value
                      }
                      product {
                        id
                        title
                        handle
                        images(first: 1) {
                          nodes {
                            url
                            altText
                          }
                        }
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
                totalTaxAmount {
                  amount
                  currencyCode
                }
              }
              totalQuantity
              note
              attributes {
                key
                value
              }
              buyerIdentity {
                email
                phone
              }
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
            attributes: line.attributes || [],
          })),
        },
      });

      if (response.data?.cartLinesAdd?.userErrors?.length > 0) {
        throw new AppError(
          `Add to cart failed: ${response.data.cartLinesAdd.userErrors[0].message}`,
          400
        );
      }

      const cart = response.data.cartLinesAdd.cart;
      return {
        ...cart,
        lines: cart.lines.nodes,
        checkoutUrl: cart.checkoutUrl,
        note: cart.note,
        attributes: cart.attributes,
        buyerIdentity: cart.buyerIdentity,
      };
    } catch (error) {
      logger.error('Error adding to cart:', error);
      throw new AppError(`Failed to add to cart: ${error}`, 500);
    }
  }

  verifyWebhook(data: string, hmacHeader: string): boolean {
    // If no webhook secret is configured, log warning and skip validation
    if (!config.shopify.webhookSecret) {
      console.warn('⚠️ SHOPIFY_WEBHOOK_SECRET not configured - webhook validation skipped (INSECURE)');
      return true; // Allow webhook through but log the security warning
    }

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

  async createWebhooks(shop: string, accessToken: string): Promise<void> {
    const client = this.getAdminClient(shop, accessToken);

    const webhooks = [
      {
        topic: 'PRODUCTS_CREATE',
        endpoint: `${config.shopify.appUrl}/api/webhooks/products/create`,
        format: 'JSON',
      },
      {
        topic: 'PRODUCTS_UPDATE',
        endpoint: `${config.shopify.appUrl}/api/webhooks/products/update`,
        format: 'JSON',
      },
      {
        topic: 'PRODUCTS_DELETE',
        endpoint: `${config.shopify.appUrl}/api/webhooks/products/delete`,
        format: 'JSON',
      },
      {
        topic: 'APP_UNINSTALLED',
        endpoint: `${config.shopify.appUrl}/api/webhooks/app/uninstalled`,
        format: 'JSON',
      },
    ];

    for (const webhook of webhooks) {
      try {
        await this.createWebhook(
          client,
          webhook.topic,
          webhook.endpoint,
          webhook.format
        );
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
        format: format.toUpperCase(),
      },
    };

    const response = await client.request(mutation, { variables });

    if (response.data?.webhookSubscriptionCreate?.userErrors?.length > 0) {
      const errors = response.data.webhookSubscriptionCreate.userErrors;
      throw new Error(`Webhook creation failed: ${errors[0].message}`);
    }

    return response.data.webhookSubscriptionCreate.webhookSubscription;
  }

  async listWebhooks(shop: string, accessToken: string): Promise<any[]> {
    const client = this.getAdminClient(shop, accessToken);

    try {
      const query = `
        query {
          webhookSubscriptions(first: 50) {
            edges {
              node {
                id
                callbackUrl
                topic
                format
                createdAt
                updatedAt
              }
            }
          }
        }
      `;

      const response = await client.request(query);
      return (
        response.data?.webhookSubscriptions?.edges?.map(
          (edge: any) => edge.node
        ) || []
      );
    } catch (error) {
      logger.error('Error listing webhooks:', error);
      throw new AppError(`Failed to list webhooks: ${error}`, 500);
    }
  }

  async deleteWebhook(
    shop: string,
    accessToken: string,
    webhookId: string
  ): Promise<void> {
    const client = this.getAdminClient(shop, accessToken);

    try {
      const mutation = `
        mutation webhookSubscriptionDelete($id: ID!) {
          webhookSubscriptionDelete(id: $id) {
            deletedWebhookSubscriptionId
            userErrors {
              field
              message
            }
          }
        }
      `;

      const response = await client.request(mutation, {
        variables: { id: webhookId },
      });

      if (response.data?.webhookSubscriptionDelete?.userErrors?.length > 0) {
        const errors = response.data.webhookSubscriptionDelete.userErrors;
        throw new Error(`Webhook deletion failed: ${errors[0].message}`);
      }

      logger.info(`Deleted webhook ${webhookId} for shop: ${shop}`);
    } catch (error) {
      logger.error('Error deleting webhook:', error);
      throw new AppError(`Failed to delete webhook: ${error}`, 500);
    }
  }

  async getCart(
    shop: string,
    storefrontToken: string,
    cartId: string
  ): Promise<ExtendedShopifyCart | null> {
    const client = this.getStorefrontClient(shop, storefrontToken);

    try {
      const query = `
        query getCart($cartId: ID!) {
          cart(id: $cartId) {
            id
            checkoutUrl
            lines(first: 100) {
              nodes {
                id
                quantity
                attributes {
                  key
                  value
                }
                merchandise {
                  ... on ProductVariant {
                    id
                    title
                    price {
                      amount
                      currencyCode
                    }
                    selectedOptions {
                      name
                      value
                    }
                    product {
                      id
                      title
                      handle
                      images(first: 1) {
                        nodes {
                          url
                          altText
                        }
                      }
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
              totalTaxAmount {
                amount
                currencyCode
              }
            }
            totalQuantity
            note
            attributes {
              key
              value
            }
            buyerIdentity {
              email
              phone
            }
          }
        }
      `;

      const response = await client.request(query, {
        variables: { cartId },
      });

      if (!response.data?.cart) {
        return null;
      }

      const cart = response.data.cart;
      return {
        id: cart.id,
        lines: cart.lines.nodes,
        cost: cart.cost,
        totalQuantity: cart.totalQuantity,
        checkoutUrl: cart.checkoutUrl,
        note: cart.note,
        attributes: cart.attributes,
        buyerIdentity: cart.buyerIdentity,
      };
    } catch (error) {
      logger.error('Error getting cart:', error);
      if (error.message?.includes('Cart not found')) {
        return null;
      }
      throw new AppError(`Failed to get cart: ${error}`, 500);
    }
  }

  async removeFromCart(
    shop: string,
    storefrontToken: string,
    cartId: string,
    lineIds: string[]
  ): Promise<ExtendedShopifyCart> {
    const client = this.getStorefrontClient(shop, storefrontToken);

    try {
      const query = `
        mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
          cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
            cart {
              id
              checkoutUrl
              lines(first: 100) {
                nodes {
                  id
                  quantity
                  attributes {
                    key
                    value
                  }
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price {
                        amount
                        currencyCode
                      }
                      selectedOptions {
                        name
                        value
                      }
                      product {
                        id
                        title
                        handle
                        images(first: 1) {
                          nodes {
                            url
                            altText
                          }
                        }
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
                totalTaxAmount {
                  amount
                  currencyCode
                }
              }
              totalQuantity
              note
              attributes {
                key
                value
              }
              buyerIdentity {
                email
                phone
              }
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
          lineIds,
        },
      });

      if (response.data?.cartLinesRemove?.userErrors?.length > 0) {
        throw new AppError(
          `Remove from cart failed: ${response.data.cartLinesRemove.userErrors[0].message}`,
          400
        );
      }

      const cart = response.data.cartLinesRemove.cart;
      return {
        ...cart,
        lines: cart.lines.nodes,
        checkoutUrl: cart.checkoutUrl,
        note: cart.note,
        attributes: cart.attributes,
        buyerIdentity: cart.buyerIdentity,
      };
    } catch (error) {
      logger.error('Error removing from cart:', error);
      throw new AppError(`Failed to remove from cart: ${error}`, 500);
    }
  }

  async updateCartLines(
    shop: string,
    storefrontToken: string,
    cartId: string,
    lines: Array<{ id: string; quantity: number }>
  ): Promise<ExtendedShopifyCart> {
    const client = this.getStorefrontClient(shop, storefrontToken);

    try {
      const query = `
        mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
          cartLinesUpdate(cartId: $cartId, lines: $lines) {
            cart {
              id
              checkoutUrl
              lines(first: 100) {
                nodes {
                  id
                  quantity
                  attributes {
                    key
                    value
                  }
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price {
                        amount
                        currencyCode
                      }
                      selectedOptions {
                        name
                        value
                      }
                      product {
                        id
                        title
                        handle
                        images(first: 1) {
                          nodes {
                            url
                            altText
                          }
                        }
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
                totalTaxAmount {
                  amount
                  currencyCode
                }
              }
              totalQuantity
              note
              attributes {
                key
                value
              }
              buyerIdentity {
                email
                phone
              }
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
            id: line.id,
            quantity: line.quantity,
          })),
        },
      });

      if (response.data?.cartLinesUpdate?.userErrors?.length > 0) {
        throw new AppError(
          `Update cart failed: ${response.data.cartLinesUpdate.userErrors[0].message}`,
          400
        );
      }

      const cart = response.data.cartLinesUpdate.cart;
      return {
        ...cart,
        lines: cart.lines.nodes,
        checkoutUrl: cart.checkoutUrl,
        note: cart.note,
        attributes: cart.attributes,
        buyerIdentity: cart.buyerIdentity,
      };
    } catch (error) {
      logger.error('Error updating cart lines:', error);
      throw new AppError(`Failed to update cart: ${error}`, 500);
    }
  }

  async updateCartBuyerIdentity(
    shop: string,
    storefrontToken: string,
    cartId: string,
    buyerIdentity: {
      email?: string;
      phone?: string;
      customerAccessToken?: string;
    }
  ): Promise<ExtendedShopifyCart> {
    const client = this.getStorefrontClient(shop, storefrontToken);

    try {
      const query = `
        mutation cartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
          cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
            cart {
              id
              checkoutUrl
              buyerIdentity {
                email
                phone
              }
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
          buyerIdentity,
        },
      });

      if (response.data?.cartBuyerIdentityUpdate?.userErrors?.length > 0) {
        throw new AppError(
          `Update cart buyer identity failed: ${response.data.cartBuyerIdentityUpdate.userErrors[0].message}`,
          400
        );
      }

      // Return the updated cart by fetching it again
      return this.getCart(
        shop,
        storefrontToken,
        cartId
      ) as Promise<ExtendedShopifyCart>;
    } catch (error) {
      logger.error('Error updating cart buyer identity:', error);
      throw new AppError(`Failed to update cart buyer identity: ${error}`, 500);
    }
  }
}
