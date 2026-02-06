/**
 * Platform-agnostic product types
 * These interfaces normalize data structures between Shopify and WooCommerce
 */

/**
 * Supported e-commerce platforms
 */
export type Platform = 'shopify' | 'woocommerce';

/**
 * Normalized product image
 */
export interface NormalizedImage {
  id: string;
  src: string;
  alt_text?: string;
  width?: number;
  height?: number;
  position?: number;
}

/**
 * Normalized product variant
 */
export interface NormalizedVariant {
  id: string;
  external_id: string; // Original platform ID (Shopify GID or WC integer)
  product_id: string;
  title: string;
  sku?: string;
  price: string;
  compare_at_price?: string;
  inventory_quantity: number;
  weight?: number;
  weight_unit?: string;
  requires_shipping: boolean;
  taxable: boolean;
  available: boolean;
  options?: Array<{
    name: string;
    value: string;
  }>;
  image?: NormalizedImage;
}

/**
 * Normalized product
 */
export interface NormalizedProduct {
  id: string;
  external_id: string; // Original platform ID (Shopify GID or WC integer)
  platform: Platform;
  title: string;
  description: string;
  handle: string;
  vendor?: string;
  product_type?: string;
  tags: string[];
  status: 'active' | 'draft' | 'archived';
  images: NormalizedImage[];
  variants: NormalizedVariant[];
  created_at: string;
  updated_at: string;
  // Price range computed from variants
  price_range?: {
    min: string;
    max: string;
    currency: string;
  };
  // Additional metadata
  metadata?: Record<string, unknown>;
}

/**
 * Product with recommendation scoring
 */
export interface NormalizedProductRecommendation extends NormalizedProduct {
  score?: number;
  reason?: string;
}

/**
 * Product search filters (platform-agnostic)
 */
export interface ProductSearchFilters {
  query?: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  priceRange?: {
    min?: number;
    max?: number;
  };
  availability?: boolean;
  sortKey?: 'created_at' | 'updated_at' | 'title' | 'price' | 'best_selling' | 'relevance';
  reverse?: boolean;
  limit?: number;
}

/**
 * Search result with similarity score (for semantic search)
 */
export interface NormalizedSearchResult extends NormalizedProduct {
  similarity?: number;
}

/**
 * Product recommendation options
 */
export interface RecommendationOptions {
  productId?: string;
  intent?: 'related' | 'complementary' | 'upsell' | 'popular';
  limit?: number;
  excludeProductIds?: string[];
}

/**
 * Helper to generate normalized IDs from platform-specific IDs
 */
export function generateNormalizedId(platform: Platform, externalId: string | number): string {
  return `${platform}-${externalId}`;
}

/**
 * Helper to extract external ID from normalized ID
 */
export function extractExternalId(normalizedId: string): { platform: Platform; externalId: string } | null {
  const match = normalizedId.match(/^(shopify|woocommerce)-(.+)$/);
  if (!match) return null;
  return {
    platform: match[1] as Platform,
    externalId: match[2],
  };
}

/**
 * Helper to generate variant normalized ID
 */
export function generateVariantId(platform: Platform, externalId: string | number): string {
  return `${platform}-var-${externalId}`;
}
