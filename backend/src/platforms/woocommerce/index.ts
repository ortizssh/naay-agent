/**
 * WooCommerce platform exports
 */

// Services
export * from './services';

// Controllers
export * from './controllers';

// Types
export * from './types';

// Register WooCommerce provider
import { registerCommerceProvider, StoreCredentials } from '../interfaces';
import { WooCommerceService } from './services/woocommerce.service';

registerCommerceProvider('woocommerce', (credentials: StoreCredentials) => {
  if (!credentials.consumer_key || !credentials.consumer_secret) {
    throw new Error('WooCommerce requires consumer_key and consumer_secret');
  }

  // Extract site URL from identifier or use a default
  const siteUrl = (credentials as any).siteUrl ||
    (credentials as any).site_url ||
    '';

  return new WooCommerceService({
    siteUrl,
    consumerKey: credentials.consumer_key,
    consumerSecret: credentials.consumer_secret,
    webhookSecret: credentials.webhook_secret,
  });
});
