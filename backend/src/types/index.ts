// Shopify Types
export interface ShopifyStore {
  id: string;
  shop_domain: string;
  access_token: string;
  scopes: string;
  installed_at: Date;
  updated_at: Date;
  widget_enabled?: boolean;
  settings?: Record<string, unknown>;
}

export type Store = ShopifyStore;

export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  handle: string;
  vendor: string;
  product_type: string;
  tags: string[];
  status?: string;
  images: ShopifyImage[];
  variants: ShopifyVariant[];
  created_at: string;
  updated_at: string;
}

export interface ShopifyVariant {
  id: string;
  product_id: string;
  title: string;
  sku: string;
  price: string;
  compare_at_price?: string;
  inventory_quantity: number;
  weight: number;
  weight_unit: string;
  requires_shipping: boolean;
  taxable: boolean;
}

export interface ShopifyImage {
  id: string;
  src: string;
  alt_text?: string;
  width: number;
  height: number;
}

export interface ShopifyCart {
  id: string;
  lines: ShopifyCartLine[];
  cost: {
    totalAmount: {
      amount: string;
      currencyCode: string;
    };
    subtotalAmount: {
      amount: string;
      currencyCode: string;
    };
  };
  totalQuantity: number;
}

export interface ShopifyCartLine {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    selectedOptions: Array<{
      name: string;
      value: string;
    }>;
    product: {
      id: string;
      title: string;
      handle: string;
    };
  };
}

// AI Agent Types
export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ChatSession {
  id: string;
  shop_domain: string;
  customer_id?: string;
  cart_id?: string;
  started_at: Date;
  last_activity: Date;
  status: 'active' | 'completed' | 'abandoned';
}

export interface AgentAction {
  type:
    | 'cart.create'
    | 'cart.add'
    | 'cart.update'
    | 'cart.remove'
    | 'cart.updateBuyerIdentity'
    | 'product.search'
    | 'product.recommend';
  params: Record<string, any>;
}

export interface AgentResponse {
  messages: string[];
  actions: AgentAction[];
  metadata?: {
    products_found?: number;
    search_query?: string;
    search_type?:
      | 'shopify_storefront'
      | 'shopify_admin'
      | 'semantic'
      | 'database_popular';
    execution_time?: number;
    intent?: string;
    error?: any;
    cart_status?: string;
    cart_id?: string;
    cart_updated?: boolean;
    recommendations_found?: number;
    recommendation_type?:
      | 'related'
      | 'complementary'
      | 'upsell'
      | 'popular'
      | 'database_popular';
    base_product_id?: string;
    has_cart_id?: boolean;
    status?: string;
    response_type?: string;
    clarification_needed?: boolean;
    source?: string;
    total_items?: number;
    total_amount?: string;
    checkout_url?: string;
    products?: Array<{
      id: string;
      title: string;
      handle?: string;
      variants?: Array<{ id: string; price: string }>;
    }>;
    recommendations?: Array<{
      id: string;
      title: string;
      score?: number;
      reason?: string;
    }>;
    cart_lines?: Array<{
      id: string;
      quantity: number;
      variant_id: string;
      product_title: string;
    }>;
    product_id?: string;
    variant_id?: string;
    quantity?: number;
  };
}

export interface ProductEmbedding {
  id: string;
  product_id: string;
  variant_id?: string;
  shop_domain?: string;
  embedding: number[];
  content: string;
  metadata: {
    title: string;
    description: string;
    vendor: string;
    tags: string[];
    price: string;
  };
  created_at: Date;
}

// API Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Webhook Types
export interface ShopifyWebhook {
  id: string;
  topic: string;
  shop_domain: string;
  payload: Record<string, any>;
  verified: boolean;
  processed: boolean;
  created_at: Date;
}

export type ShopifyWebhookPayload = Record<string, any>;

// Queue Types
export interface QueueJob {
  id: string;
  type:
    | 'sync_product'
    | 'generate_embedding'
    | 'process_webhook'
    | 'send_notification';
  data: Record<string, any>;
  priority: number;
  attempts: number;
  created_at: Date;
}

// Configuration Types
export interface AppConfig {
  shopify: {
    apiKey: string;
    apiSecret: string;
    scopes: string;
    webhookSecret: string;
    appUrl: string;
  };
  supabase: {
    url: string;
    anonKey: string;
    serviceKey: string;
  };
  openai: {
    apiKey: string;
    model: string;
    embeddingModel: string;
  };
  server: {
    port: number;
    nodeEnv: string;
    jwtSecret: string;
  };
  redis: {
    url?: string;
    host: string;
    port: number;
    password?: string;
    enabled: boolean;
  };
}

// Enhanced Error Types and Codes for Shopify App
export enum ErrorCode {
  // General Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Shopify-specific Errors
  SHOPIFY_AUTH_ERROR = 'SHOPIFY_AUTH_ERROR',
  SHOPIFY_API_ERROR = 'SHOPIFY_API_ERROR',
  SHOPIFY_WEBHOOK_ERROR = 'SHOPIFY_WEBHOOK_ERROR',
  SHOPIFY_SESSION_EXPIRED = 'SHOPIFY_SESSION_EXPIRED',
  SHOPIFY_SHOP_NOT_FOUND = 'SHOPIFY_SHOP_NOT_FOUND',
  SHOPIFY_PERMISSION_DENIED = 'SHOPIFY_PERMISSION_DENIED',
  SHOPIFY_RATE_LIMIT = 'SHOPIFY_RATE_LIMIT',
  SHOPIFY_UNINSTALLED = 'SHOPIFY_UNINSTALLED',

  // AI/Embedding Errors
  OPENAI_API_ERROR = 'OPENAI_API_ERROR',
  EMBEDDING_GENERATION_ERROR = 'EMBEDDING_GENERATION_ERROR',
  INTENT_ANALYSIS_ERROR = 'INTENT_ANALYSIS_ERROR',
  AI_RESPONSE_ERROR = 'AI_RESPONSE_ERROR',
  AI_TIMEOUT = 'AI_TIMEOUT',

  // Database Errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  SUPABASE_ERROR = 'SUPABASE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',

  // Product/Search Errors
  PRODUCT_SYNC_ERROR = 'PRODUCT_SYNC_ERROR',
  SEARCH_ERROR = 'SEARCH_ERROR',
  EMBEDDING_NOT_FOUND = 'EMBEDDING_NOT_FOUND',
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly shopDomain?: string;
  public readonly metadata?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    isOperational: boolean = true,
    shopDomain?: string,
    metadata?: Record<string, any>
  ) {
    super(message);

    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.shopDomain = shopDomain;
    this.metadata = metadata;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      shopDomain: this.shopDomain,
      metadata: this.metadata,
      timestamp: new Date().toISOString(),
    };
  }
}

// Shopify-specific error classes
export class ShopifyError extends AppError {
  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCode = ErrorCode.SHOPIFY_API_ERROR,
    shopDomain?: string,
    metadata?: Record<string, any>
  ) {
    super(message, statusCode, code, true, shopDomain, metadata);
    this.name = 'ShopifyError';
  }
}

export class ShopifyAuthError extends AppError {
  constructor(
    message: string = 'Shopify authentication failed',
    shopDomain?: string,
    metadata?: Record<string, any>
  ) {
    super(
      message,
      401,
      ErrorCode.SHOPIFY_AUTH_ERROR,
      true,
      shopDomain,
      metadata
    );
    this.name = 'ShopifyAuthError';
  }
}

export class ShopifyRateLimitError extends AppError {
  public readonly resetTime: Date;

  constructor(
    resetTime: Date,
    shopDomain?: string,
    message: string = 'Shopify API rate limit exceeded'
  ) {
    super(
      `${message}. Reset at: ${resetTime.toISOString()}`,
      429,
      ErrorCode.SHOPIFY_RATE_LIMIT,
      true,
      shopDomain,
      { resetTime }
    );
    this.name = 'ShopifyRateLimitError';
    this.resetTime = resetTime;
  }
}

export class ShopifyWebhookError extends AppError {
  constructor(
    message: string,
    shopDomain?: string,
    metadata?: Record<string, any>
  ) {
    super(
      message,
      400,
      ErrorCode.SHOPIFY_WEBHOOK_ERROR,
      true,
      shopDomain,
      metadata
    );
    this.name = 'ShopifyWebhookError';
  }
}

export class SupabaseError extends AppError {
  constructor(
    message: string,
    statusCode: number = 500,
    metadata?: Record<string, any>
  ) {
    super(
      message,
      statusCode,
      ErrorCode.SUPABASE_ERROR,
      true,
      undefined,
      metadata
    );
    this.name = 'SupabaseError';
  }
}

// AI-specific error classes
export class AIError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.AI_RESPONSE_ERROR,
    metadata?: Record<string, any>
  ) {
    super(message, 500, code, true, undefined, metadata);
    this.name = 'AIError';
  }
}

export class EmbeddingError extends AppError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(
      message,
      500,
      ErrorCode.EMBEDDING_GENERATION_ERROR,
      true,
      undefined,
      metadata
    );
    this.name = 'EmbeddingError';
  }
}

// Validation error class
export class ValidationError extends AppError {
  public readonly field?: string;

  constructor(message: string, field?: string, metadata?: Record<string, any>) {
    super(message, 400, ErrorCode.VALIDATION_ERROR, true, undefined, metadata);
    this.name = 'ValidationError';
    this.field = field;
  }
}

// Rate limiting error for general API
export class RateLimitError extends AppError {
  public readonly limit: number;
  public readonly resetTime: Date;

  constructor(limit: number, resetTime: Date, shopDomain?: string) {
    super(
      `Rate limit exceeded. Limit: ${limit} requests. Try again after ${resetTime.toISOString()}`,
      429,
      ErrorCode.RATE_LIMIT_EXCEEDED,
      true,
      shopDomain,
      { limit, resetTime }
    );
    this.name = 'RateLimitError';
    this.limit = limit;
    this.resetTime = resetTime;
  }
}

// Intent Analysis Type
export interface IntentAnalysis {
  intent: string;
  confidence: number;
  entities: Record<string, any>;
  context: Record<string, any>;
}

// Enhanced API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: ErrorCode;
    details?: any;
    shopDomain?: string;
  };
  metadata?: {
    timestamp: string;
    shop?: string;
    requestId?: string;
    processingTime?: number;
    version?: string;
  };
}

// Shopify-specific enhanced types
export interface ShopifySessionData {
  shop: string;
  accessToken: string;
  scopes: string;
  expiresAt?: Date;
  userId?: string;
  isOnline: boolean;
  installedAt: Date;
  updatedAt: Date;
}

// Performance Monitoring Types for Shopify
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'count' | 'bytes' | 'percentage';
  shop?: string;
  endpoint?: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

// Product search filters interface
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
  sortKey?:
    | 'CREATED_AT'
    | 'UPDATED_AT'
    | 'TITLE'
    | 'PRICE'
    | 'VENDOR'
    | 'PRODUCT_TYPE'
    | 'BEST_SELLING'
    | 'RELEVANCE';
  reverse?: boolean;
  limit?: number;
}

// Product recommendation interface
export interface ProductRecommendation extends ShopifyProduct {
  score?: number;
  reason?: string;
}

// Cart line input for adding products to cart
export interface CartLineInput {
  merchandiseId: string;
  quantity: number;
  attributes?: Array<{
    key: string;
    value: string;
  }>;
}

// Extended cart interface with additional Storefront API properties
export interface ExtendedShopifyCart extends ShopifyCart {
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

// Search result with similarity score for semantic search
export interface SearchResult extends ShopifyProduct {
  similarity: number;
}

// Enhanced Chat Context for Shopify
export interface ChatContext {
  sessionId: string;
  shop: string;
  customerId?: string;
  cartId?: string;
  previousMessages: ChatMessage[];
  userPreferences?: Record<string, any>;
  shopifyContext?: {
    currency: string;
    timezone: string;
    locale: string;
    plan: string;
  };
}

// Extended Request interface for webhooks
declare global {
  namespace Express {
    export interface Request {
      rawBody?: Buffer;
    }
  }
}
