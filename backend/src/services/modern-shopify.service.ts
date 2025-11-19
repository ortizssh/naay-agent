import { ShopifyService } from './shopify.service';
import { logger } from '@/utils/logger';

/**
 * Modern Shopify Service extending the base service
 * Adds session token support and modern authentication patterns
 */
export class ModernShopifyService extends ShopifyService {
  constructor() {
    super();
  }

  /**
   * Enhanced product fetching with automatic token handling
   */
  async getAllProductsWithAuth(
    shop: string,
    accessToken: string
  ): Promise<any[]> {
    try {
      logger.info(`Fetching products with modern auth for shop: ${shop}`);

      // Use the existing getAllProducts method from parent class
      const products = await this.getAllProducts(shop, accessToken);

      logger.info(
        `Successfully fetched ${products.length} products with modern auth`
      );
      return products;
    } catch (error) {
      logger.error('Error fetching products with modern auth:', error);
      throw error;
    }
  }

  /**
   * Enhanced webhook creation with modern patterns
   */
  async createWebhooksWithAuth(
    shop: string,
    accessToken: string
  ): Promise<void> {
    try {
      logger.info(`Creating webhooks with modern auth for shop: ${shop}`);

      // Use the existing createWebhooks method from parent class
      await this.createWebhooks(shop, accessToken);

      logger.info(
        `Successfully created webhooks with modern auth for shop: ${shop}`
      );
    } catch (error) {
      logger.error('Error creating webhooks with modern auth:', error);
      throw error;
    }
  }
}
