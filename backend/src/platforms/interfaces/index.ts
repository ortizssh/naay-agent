/**
 * Platform interfaces - Re-export all interfaces
 */

// Product types and interfaces
export {
  Platform,
  NormalizedImage,
  NormalizedVariant,
  NormalizedProduct,
  NormalizedProductRecommendation,
  ProductSearchFilters,
  NormalizedSearchResult,
  RecommendationOptions,
  generateNormalizedId,
  extractExternalId,
  generateVariantId,
} from './product.interface';

// Cart types and interfaces
export {
  NormalizedCartLine,
  NormalizedCartCost,
  BuyerIdentity,
  NormalizedCart,
  CartLineInput,
  CartLineUpdateInput,
  ICartProvider,
} from './cart.interface';

// Commerce provider types and interfaces
export {
  WebhookTopic,
  NormalizedWebhook,
  NormalizedOrderLineItem,
  NormalizedOrder,
  NormalizedStore,
  StoreCredentials,
  ICommerceProvider,
  IAuthProvider,
  CommerceProviderFactory,
  commerceProviders,
  registerCommerceProvider,
  getCommerceProvider,
} from './commerce.interface';
