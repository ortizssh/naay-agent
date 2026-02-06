/**
 * WooCommerce-specific types
 * Based on WooCommerce REST API v3
 */

/**
 * WooCommerce product status
 */
export type WooProductStatus = 'draft' | 'pending' | 'private' | 'publish';

/**
 * WooCommerce product type
 */
export type WooProductType = 'simple' | 'grouped' | 'external' | 'variable';

/**
 * WooCommerce product image
 */
export interface WooProductImage {
  id: number;
  src: string;
  name?: string;
  alt?: string;
  position?: number;
}

/**
 * WooCommerce product attribute
 */
export interface WooProductAttribute {
  id: number;
  name: string;
  position: number;
  visible: boolean;
  variation: boolean;
  options: string[];
}

/**
 * WooCommerce product category
 */
export interface WooProductCategory {
  id: number;
  name: string;
  slug: string;
}

/**
 * WooCommerce product tag
 */
export interface WooProductTag {
  id: number;
  name: string;
  slug: string;
}

/**
 * WooCommerce product dimensions
 */
export interface WooProductDimensions {
  length: string;
  width: string;
  height: string;
}

/**
 * WooCommerce product variation (for variable products)
 */
export interface WooProductVariation {
  id: number;
  sku: string;
  price: string;
  regular_price: string;
  sale_price?: string;
  stock_quantity: number | null;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  weight?: string;
  dimensions?: WooProductDimensions;
  image?: WooProductImage;
  attributes: Array<{
    id: number;
    name: string;
    option: string;
  }>;
  manage_stock: boolean;
  purchasable: boolean;
}

/**
 * WooCommerce product (from REST API)
 */
export interface WooProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  type: WooProductType;
  status: WooProductStatus;
  featured: boolean;
  catalog_visibility: 'visible' | 'catalog' | 'search' | 'hidden';
  description: string;
  short_description: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price?: string;
  on_sale: boolean;
  purchasable: boolean;
  total_sales: number;
  virtual: boolean;
  downloadable: boolean;
  external_url?: string;
  button_text?: string;
  tax_status: 'taxable' | 'shipping' | 'none';
  tax_class: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  backorders: 'no' | 'notify' | 'yes';
  backorders_allowed: boolean;
  backordered: boolean;
  sold_individually: boolean;
  weight?: string;
  dimensions?: WooProductDimensions;
  shipping_required: boolean;
  shipping_taxable: boolean;
  shipping_class: string;
  shipping_class_id: number;
  reviews_allowed: boolean;
  average_rating: string;
  rating_count: number;
  related_ids: number[];
  upsell_ids: number[];
  cross_sell_ids: number[];
  parent_id: number;
  categories: WooProductCategory[];
  tags: WooProductTag[];
  images: WooProductImage[];
  attributes: WooProductAttribute[];
  default_attributes: Array<{ id: number; name: string; option: string }>;
  variations: number[]; // IDs of variations for variable products
  grouped_products: number[];
  menu_order: number;
  date_created: string;
  date_modified: string;
}

/**
 * WooCommerce order line item
 */
export interface WooOrderLineItem {
  id: number;
  name: string;
  product_id: number;
  variation_id: number;
  quantity: number;
  tax_class: string;
  subtotal: string;
  subtotal_tax: string;
  total: string;
  total_tax: string;
  sku: string;
  price: number;
}

/**
 * WooCommerce order address
 */
export interface WooOrderAddress {
  first_name: string;
  last_name: string;
  company?: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email?: string;
  phone?: string;
}

/**
 * WooCommerce order (from REST API)
 */
export interface WooOrder {
  id: number;
  parent_id: number;
  number: string;
  order_key: string;
  created_via: string;
  version: string;
  status: string;
  currency: string;
  date_created: string;
  date_modified: string;
  discount_total: string;
  discount_tax: string;
  shipping_total: string;
  shipping_tax: string;
  cart_tax: string;
  total: string;
  total_tax: string;
  prices_include_tax: boolean;
  customer_id: number;
  customer_ip_address: string;
  customer_user_agent: string;
  customer_note: string;
  billing: WooOrderAddress;
  shipping: WooOrderAddress;
  payment_method: string;
  payment_method_title: string;
  transaction_id: string;
  date_paid?: string;
  date_completed?: string;
  cart_hash: string;
  line_items: WooOrderLineItem[];
}

/**
 * WooCommerce webhook topic mapping
 */
export const WOO_WEBHOOK_TOPICS = {
  'product.created': 'product.created',
  'product.updated': 'product.updated',
  'product.deleted': 'product.deleted',
  'order.created': 'order.created',
  'order.updated': 'order.updated',
  'order.deleted': 'order.deleted',
  'customer.created': 'customer.created',
  'customer.updated': 'customer.updated',
} as const;

/**
 * WooCommerce webhook payload
 */
export interface WooWebhook {
  id: number;
  name: string;
  status: 'active' | 'paused' | 'disabled';
  topic: string;
  resource: string;
  event: string;
  hooks: string[];
  delivery_url: string;
  secret: string;
  date_created: string;
  date_modified: string;
}

/**
 * WooCommerce Store API Cart Item
 */
export interface WooStoreCartItem {
  key: string;
  id: number;
  quantity: number;
  quantity_limits: {
    minimum: number;
    maximum: number;
    multiple_of: number;
    editable: boolean;
  };
  name: string;
  short_description: string;
  description: string;
  sku: string;
  low_stock_remaining: number | null;
  permalink: string;
  images: Array<{
    id: number;
    src: string;
    thumbnail: string;
    srcset: string;
    sizes: string;
    name: string;
    alt: string;
  }>;
  variation: Array<{
    attribute: string;
    value: string;
  }>;
  item_data: Array<{
    name: string;
    value: string;
    display: string;
  }>;
  prices: {
    price: string;
    regular_price: string;
    sale_price: string;
    price_range: null | {
      min_amount: string;
      max_amount: string;
    };
    currency_code: string;
    currency_symbol: string;
    currency_minor_unit: number;
    currency_decimal_separator: string;
    currency_thousand_separator: string;
    currency_prefix: string;
    currency_suffix: string;
  };
  totals: {
    line_subtotal: string;
    line_subtotal_tax: string;
    line_total: string;
    line_total_tax: string;
    currency_code: string;
  };
}

/**
 * WooCommerce Store API Cart
 */
export interface WooStoreCart {
  coupons: Array<{
    code: string;
    totals: {
      currency_code: string;
      total_discount: string;
      total_discount_tax: string;
    };
  }>;
  shipping_rates: Array<{
    package_id: number;
    name: string;
    destination: WooOrderAddress;
    items: Array<{
      key: string;
      name: string;
      quantity: number;
    }>;
    shipping_rates: Array<{
      rate_id: string;
      name: string;
      description: string;
      price: string;
      taxes: string;
      instance_id: number;
      method_id: string;
      selected: boolean;
    }>;
  }>;
  items: WooStoreCartItem[];
  items_count: number;
  items_weight: number;
  cross_sells: WooProduct[];
  needs_payment: boolean;
  needs_shipping: boolean;
  totals: {
    subtotal: string;
    subtotal_tax: string;
    shipping_total: string;
    shipping_tax: string;
    discount_total: string;
    discount_tax: string;
    total: string;
    total_tax: string;
    currency_code: string;
    currency_symbol: string;
    currency_minor_unit: number;
    currency_decimal_separator: string;
    currency_thousand_separator: string;
    currency_prefix: string;
    currency_suffix: string;
    total_items: string;
    total_items_tax: string;
    total_fees: string;
    total_fees_tax: string;
    total_price: string;
  };
}

/**
 * WooCommerce API credentials
 */
export interface WooCredentials {
  siteUrl: string;
  consumerKey: string;
  consumerSecret: string;
  webhookSecret?: string;
}

/**
 * WooCommerce connection test result
 */
export interface WooConnectionTestResult {
  success: boolean;
  storeName?: string;
  storeUrl?: string;
  woocommerceVersion?: string;
  currency?: string;
  error?: string;
}
