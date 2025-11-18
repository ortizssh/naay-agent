export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ChatSession {
  id: string;
  shop_domain: string;
  started_at: Date;
  status: 'active' | 'completed' | 'abandoned';
}

export interface WidgetConfig {
  shopDomain: string;
  apiEndpoint: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  primaryColor?: string;
  greeting?: string;
  placeholder?: string;
  avatar?: string;
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
  customCSS?: string;
}

export interface ChatResponse {
  success: boolean;
  data: {
    messages: string[];
    actions: Array<{
      type: string;
      params: Record<string, any>;
    }>;
    metadata?: Record<string, any>;
  };
  error?: string;
}

export interface SessionResponse {
  success: boolean;
  data: ChatSession;
  error?: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: string;
  handle: string;
  vendor: string;
  images?: Array<{
    src: string;
    alt_text?: string;
  }>;
}

export interface CartInfo {
  id: string;
  lines: Array<{
    id: string;
    quantity: number;
    merchandise: {
      id: string;
      title: string;
      product: {
        id: string;
        title: string;
        handle: string;
      };
    };
  }>;
  totalQuantity: number;
  cost: {
    totalAmount: {
      amount: string;
      currencyCode: string;
    };
  };
}

export interface WidgetState {
  isOpen: boolean;
  isMinimized: boolean;
  isLoading: boolean;
  messages: ChatMessage[];
  currentInput: string;
  sessionId: string | null;
  cartId: string | null;
  hasUnread: boolean;
}
