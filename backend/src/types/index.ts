// Shopify Types
export interface ShopifyStore {
  id: string;
  shop_domain: string;
  access_token: string;
  scopes: string;
  installed_at: Date;
  updated_at: Date;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  handle: string;
  vendor: string;
  product_type: string;
  tags: string[];
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
    execution_time?: number;
  };
}

export interface ProductEmbedding {
  id: string;
  product_id: string;
  variant_id?: string;
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
    url: string;
  };
}

// Error Types
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ShopifyError extends AppError {
  constructor(message: string, statusCode: number = 500) {
    super(message, statusCode, 'SHOPIFY_ERROR');
  }
}

export class SupabaseError extends AppError {
  constructor(message: string, statusCode: number = 500) {
    super(message, statusCode, 'SUPABASE_ERROR');
  }
}
