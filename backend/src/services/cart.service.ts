import { ShopifyService } from './shopify.service';
import { SupabaseService } from './supabase.service';
import { logger } from '@/utils/logger';
import { AppError, ShopifyCart } from '@/types';

interface CartLineInput {
  merchandiseId: string; // Shopify variant ID
  quantity: number;
}

interface CartUpdateInput {
  cartId: string;
  lines?: CartLineInput[];
  buyerIdentity?: {
    customerAccessToken?: string;
    email?: string;
  };
}

export class CartService {
  private shopifyService: ShopifyService;
  private supabaseService: SupabaseService;

  constructor() {
    this.shopifyService = new ShopifyService();
    this.supabaseService = new SupabaseService();
  }

  async createCart(shop: string): Promise<ShopifyCart> {
    try {
      // Get store to access storefront token
      const store = await this.supabaseService.getStore(shop);
      if (!store) {
        throw new AppError('Store not found', 404);
      }

      // For now, use the same token - in production you'd have a separate storefront access token
      const cart = await this.shopifyService.createCart(
        shop,
        store.access_token
      );

      logger.info(`Cart created for shop: ${shop}`, {
        cartId: cart.id,
        totalQuantity: cart.totalQuantity,
      });

      return cart;
    } catch (error) {
      logger.error('Error creating cart:', error);
      throw new AppError(`Failed to create cart: ${error.message}`, 500);
    }
  }

  async addToCart(
    shop: string,
    cartId: string,
    lines: CartLineInput[]
  ): Promise<ShopifyCart> {
    try {
      const store = await this.supabaseService.getStore(shop);
      if (!store) {
        throw new AppError('Store not found', 404);
      }

      // Validate product variants exist
      await this.validateVariants(
        shop,
        lines.map(line => line.merchandiseId)
      );

      const updatedCart = await this.shopifyService.addToCart(
        shop,
        store.access_token,
        cartId,
        lines
      );

      logger.info(`Items added to cart`, {
        shop,
        cartId,
        itemsAdded: lines.length,
        totalQuantity: updatedCart.totalQuantity,
      });

      // Log analytics event
      await this.logCartEvent(shop, cartId, 'items_added', {
        items: lines,
        cart_total: updatedCart.cost.totalAmount.amount,
      });

      return updatedCart;
    } catch (error) {
      logger.error('Error adding to cart:', error);
      throw new AppError(`Failed to add to cart: ${error.message}`, 500);
    }
  }

  async updateCartLines(
    shop: string,
    cartId: string,
    lines: Array<{
      id: string;
      quantity: number;
      merchandiseId?: string;
    }>
  ): Promise<ShopifyCart> {
    try {
      const store = await this.supabaseService.getStore(shop);
      if (!store) {
        throw new AppError('Store not found', 404);
      }

      // Use Storefront API to update cart lines
      const mutation = `
        mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
          cartLinesUpdate(cartId: $cartId, lines: $lines) {
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

      const client = this.shopifyService.getStorefrontClient(
        shop,
        store.access_token
      );
      const response = await client.request(mutation, {
        variables: {
          cartId,
          lines: lines.map(line => ({
            id: line.id,
            quantity: line.quantity,
            ...(line.merchandiseId && { merchandiseId: line.merchandiseId }),
          })),
        },
      });

      if (response.data?.cartLinesUpdate?.userErrors?.length > 0) {
        throw new AppError(
          `Cart update failed: ${response.data.cartLinesUpdate.userErrors[0].message}`,
          400
        );
      }

      const updatedCart = response.data.cartLinesUpdate.cart;

      logger.info(`Cart lines updated`, {
        shop,
        cartId,
        linesUpdated: lines.length,
        totalQuantity: updatedCart.totalQuantity,
      });

      await this.logCartEvent(shop, cartId, 'cart_updated', {
        updates: lines,
        cart_total: updatedCart.cost.totalAmount.amount,
      });

      return updatedCart;
    } catch (error) {
      logger.error('Error updating cart lines:', error);
      throw new AppError(`Failed to update cart: ${error.message}`, 500);
    }
  }

  async removeFromCart(
    shop: string,
    cartId: string,
    lineIds: string[]
  ): Promise<ShopifyCart> {
    try {
      const store = await this.supabaseService.getStore(shop);
      if (!store) {
        throw new AppError('Store not found', 404);
      }

      const mutation = `
        mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
          cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
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

      const client = this.shopifyService.getStorefrontClient(
        shop,
        store.access_token
      );
      const response = await client.request(mutation, {
        variables: { cartId, lineIds },
      });

      if (response.data?.cartLinesRemove?.userErrors?.length > 0) {
        throw new AppError(
          `Remove from cart failed: ${response.data.cartLinesRemove.userErrors[0].message}`,
          400
        );
      }

      const updatedCart = response.data.cartLinesRemove.cart;

      logger.info(`Items removed from cart`, {
        shop,
        cartId,
        itemsRemoved: lineIds.length,
        totalQuantity: updatedCart.totalQuantity,
      });

      await this.logCartEvent(shop, cartId, 'items_removed', {
        removed_line_ids: lineIds,
        cart_total: updatedCart.cost.totalAmount.amount,
      });

      return updatedCart;
    } catch (error) {
      logger.error('Error removing from cart:', error);
      throw new AppError(`Failed to remove from cart: ${error.message}`, 500);
    }
  }

  async getCart(shop: string, cartId: string): Promise<ShopifyCart | null> {
    try {
      const store = await this.supabaseService.getStore(shop);
      if (!store) {
        throw new AppError('Store not found', 404);
      }

      const query = `
        query getCart($cartId: ID!) {
          cart(id: $cartId) {
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
        }
      `;

      const client = this.shopifyService.getStorefrontClient(
        shop,
        store.access_token
      );
      const response = await client.request(query, {
        variables: { cartId },
      });

      return response.data?.cart || null;
    } catch (error) {
      logger.error('Error fetching cart:', error);
      return null; // Don't throw for cart fetch - might just be expired
    }
  }

  async clearCart(shop: string, cartId: string): Promise<ShopifyCart> {
    try {
      // Get current cart to find all line IDs
      const currentCart = await this.getCart(shop, cartId);
      if (!currentCart || currentCart.lines.length === 0) {
        return (
          currentCart || {
            id: cartId,
            lines: [],
            cost: {
              totalAmount: { amount: '0', currencyCode: 'USD' },
              subtotalAmount: { amount: '0', currencyCode: 'USD' },
            },
            totalQuantity: 0,
          }
        );
      }

      const lineIds = currentCart.lines.map(line => line.id);
      return await this.removeFromCart(shop, cartId, lineIds);
    } catch (error) {
      logger.error('Error clearing cart:', error);
      throw new AppError(`Failed to clear cart: ${error.message}`, 500);
    }
  }

  private async validateVariants(
    shop: string,
    variantIds: string[]
  ): Promise<void> {
    try {
      for (const variantId of variantIds) {
        const { data, error } = await (
          this.supabaseService as any
        ).serviceClient
          .from('product_variants')
          .select('id, inventory_quantity')
          .eq('shop_domain', shop)
          .eq('id', variantId)
          .single();

        if (error || !data) {
          throw new AppError(`Product variant ${variantId} not found`, 400);
        }

        // Check inventory (basic check - Shopify will do the final validation)
        if (data.inventory_quantity <= 0) {
          logger.warn(`Low inventory for variant ${variantId}`, {
            shop,
            variantId,
            inventory: data.inventory_quantity,
          });
        }
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error validating variants:', error);
      // Don't throw - let Shopify handle validation
    }
  }

  private async logCartEvent(
    shop: string,
    cartId: string,
    eventType: string,
    eventData: Record<string, any>
  ): Promise<void> {
    try {
      const { error } = await (this.supabaseService as any).serviceClient
        .from('analytics_events')
        .insert({
          shop_domain: shop,
          event_type: eventType,
          event_data: {
            cart_id: cartId,
            ...eventData,
          },
        });

      if (error) {
        logger.error('Error logging cart event:', error);
      }
    } catch (error) {
      logger.error('Failed to log cart event:', error);
    }
  }
}
