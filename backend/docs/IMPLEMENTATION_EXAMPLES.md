# AI Agent Implementation Examples

## Quick Start Integration

### Basic Chat Widget Implementation

```html
<!DOCTYPE html>
<html>
<head>
    <title>Shopify Store with AI Agent</title>
</head>
<body>
    <!-- Your existing content -->
    
    <!-- AI Chat Widget -->
    <div id="naay-chat-widget"></div>
    
    <script>
        // Initialize the AI chat widget
        window.NaayChat = {
            config: {
                shop: 'your-store.myshopify.com',
                apiEndpoint: 'https://your-backend.azurewebsites.net/api/chat',
                customerId: null, // Set if customer is logged in
                cartId: null,     // Set if cart exists
            }
        };
        
        // Basic chat interaction
        async function sendMessage(message) {
            const response = await fetch(window.NaayChat.config.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shop-Domain': window.NaayChat.config.shop
                },
                body: JSON.stringify({
                    message: message,
                    shop: window.NaayChat.config.shop,
                    conversationId: getConversationId(),
                    context: {
                        cartId: getCartId(),
                        customerId: getCustomerId(),
                        url: window.location.href
                    }
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                displayMessage(data.data.response);
                
                // Update cart ID if returned
                if (data.data.metadata?.cart_id) {
                    setCartId(data.data.metadata.cart_id);
                }
                
                // Handle checkout redirection
                if (data.data.metadata?.checkout_url) {
                    showCheckoutOption(data.data.metadata.checkout_url);
                }
            }
        }
        
        function getCartId() {
            return localStorage.getItem('shopify_cart_id') || 
                   window.Shopify?.cart?.id;
        }
        
        function setCartId(cartId) {
            localStorage.setItem('shopify_cart_id', cartId);
        }
        
        function getCustomerId() {
            return window.Shopify?.customer?.id;
        }
        
        function getConversationId() {
            let id = localStorage.getItem('naay_conversation_id');
            if (!id) {
                id = 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('naay_conversation_id', id);
            }
            return id;
        }
        
        function displayMessage(message) {
            // Your UI implementation here
            console.log('AI Agent:', message);
        }
        
        function showCheckoutOption(checkoutUrl) {
            if (confirm('Ready to checkout? This will take you to the Shopify checkout.')) {
                window.location.href = checkoutUrl;
            }
        }
    </script>
</body>
</html>
```

### Advanced Product Search Integration

```typescript
// Product search service
class ProductSearchService {
    private apiEndpoint: string;
    private shop: string;
    
    constructor(shop: string, apiEndpoint: string) {
        this.shop = shop;
        this.apiEndpoint = apiEndpoint;
    }
    
    async searchProducts(query: string, filters?: {
        priceRange?: { min: number; max: number };
        vendor?: string;
        category?: string;
        sortBy?: 'price' | 'popularity' | 'newest';
    }) {
        const searchMessage = this.buildSearchQuery(query, filters);
        
        const response = await fetch(`${this.apiEndpoint}/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shop-Domain': this.shop
            },
            body: JSON.stringify({
                message: searchMessage,
                session_id: this.getSessionId(),
                context: {
                    intent: 'search_products',
                    filters: filters
                }
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.data.metadata?.products) {
            return {
                products: data.data.metadata.products,
                total: data.data.metadata.products_found,
                message: data.data.messages[0],
                searchType: data.data.metadata.search_type
            };
        }
        
        throw new Error('Search failed');
    }
    
    private buildSearchQuery(query: string, filters?: any): string {
        let searchQuery = `Find products: ${query}`;
        
        if (filters?.priceRange) {
            searchQuery += ` under $${filters.priceRange.max}`;
            if (filters.priceRange.min) {
                searchQuery += ` over $${filters.priceRange.min}`;
            }
        }
        
        if (filters?.vendor) {
            searchQuery += ` by ${filters.vendor}`;
        }
        
        if (filters?.category) {
            searchQuery += ` in ${filters.category} category`;
        }
        
        return searchQuery;
    }
    
    private getSessionId(): string {
        // Implementation depends on your session management
        return localStorage.getItem('chat_session_id') || 
               `session_${Date.now()}`;
    }
}

// Usage example
const productSearch = new ProductSearchService(
    'your-store.myshopify.com',
    'https://your-backend.azurewebsites.net/api/chat'
);

// Search for products
const results = await productSearch.searchProducts('red dresses', {
    priceRange: { min: 50, max: 200 },
    sortBy: 'price'
});

console.log('Found products:', results.products);
```

### Cart Management Implementation

```typescript
class CartManager {
    private apiEndpoint: string;
    private shop: string;
    private sessionId: string;
    private cartId: string | null = null;
    
    constructor(shop: string, apiEndpoint: string) {
        this.shop = shop;
        this.apiEndpoint = apiEndpoint;
        this.sessionId = this.generateSessionId();
        this.cartId = this.getStoredCartId();
    }
    
    async addProductToCart(productId: string, quantity: number = 1) {
        const message = `Add product ${productId} to cart, quantity ${quantity}`;
        
        const response = await this.sendChatMessage(message);
        
        if (response.data.metadata?.cart_updated) {
            this.cartId = response.data.metadata.cart_id;
            this.storeCartId(this.cartId);
        }
        
        return {
            success: response.success,
            message: response.data.messages[0],
            cartId: this.cartId,
            checkoutUrl: response.data.metadata?.checkout_url
        };
    }
    
    async viewCart() {
        const response = await this.sendChatMessage('Show me my cart');
        
        return {
            success: response.success,
            message: response.data.messages[0],
            cartLines: response.data.metadata?.cart_lines,
            totalAmount: response.data.metadata?.total_amount,
            totalItems: response.data.metadata?.total_items,
            checkoutUrl: response.data.metadata?.checkout_url
        };
    }
    
    async removeFromCart(itemNumber: number) {
        const message = `Remove item ${itemNumber} from cart`;
        return await this.sendChatMessage(message);
    }
    
    async getRecommendations() {
        const message = 'Show me product recommendations';
        const response = await this.sendChatMessage(message);
        
        return {
            recommendations: response.data.metadata?.recommendations,
            message: response.data.messages[0]
        };
    }
    
    private async sendChatMessage(message: string) {
        const response = await fetch(`${this.apiEndpoint}/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shop-Domain': this.shop
            },
            body: JSON.stringify({
                message,
                session_id: this.sessionId,
                cart_id: this.cartId
            })
        });
        
        return await response.json();
    }
    
    private generateSessionId(): string {
        return `cart_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    private getStoredCartId(): string | null {
        return localStorage.getItem('shopify_cart_id');
    }
    
    private storeCartId(cartId: string): void {
        if (cartId) {
            localStorage.setItem('shopify_cart_id', cartId);
        }
    }
}

// Usage example
const cartManager = new CartManager(
    'your-store.myshopify.com',
    'https://your-backend.azurewebsites.net/api/chat'
);

// Add product to cart
const result = await cartManager.addProductToCart('gid://shopify/Product/123', 2);
console.log('Add to cart result:', result.message);

// View cart
const cart = await cartManager.viewCart();
console.log('Cart contents:', cart.message);

// Get recommendations
const recommendations = await cartManager.getRecommendations();
console.log('Recommendations:', recommendations.message);
```

### React Component Example

```tsx
import React, { useState, useEffect } from 'react';

interface Product {
    id: string;
    title: string;
    handle?: string;
    variants?: Array<{ id: string; price: string }>;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    metadata?: any;
}

const AIChatComponent: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [cartId, setCartId] = useState<string | null>(null);
    const [sessionId] = useState(() => 
        `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    );
    
    const sendMessage = async (message: string) => {
        if (!message.trim() || loading) return;
        
        setLoading(true);
        
        // Add user message to chat
        const userMessage: ChatMessage = { role: 'user', content: message };
        setMessages(prev => [...prev, userMessage]);
        
        try {
            const response = await fetch('/api/chat/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shop-Domain': window.Shopify?.shop || 'your-store.myshopify.com'
                },
                body: JSON.stringify({
                    message,
                    session_id: sessionId,
                    cart_id: cartId,
                    context: {
                        customerId: window.Shopify?.customer?.id,
                        url: window.location.href
                    }
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Add assistant message
                const assistantMessage: ChatMessage = {
                    role: 'assistant',
                    content: data.data.messages[0],
                    metadata: data.data.metadata
                };
                setMessages(prev => [...prev, assistantMessage]);
                
                // Update cart ID if provided
                if (data.data.metadata?.cart_id) {
                    setCartId(data.data.metadata.cart_id);
                }
            } else {
                throw new Error('Failed to get response');
            }
        } catch (error) {
            const errorMessage: ChatMessage = {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.'
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
            setInput('');
        }
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };
    
    const quickActions = [
        'Show me new arrivals',
        'I need a gift under $50',
        'Show my cart',
        'Recommend products for me'
    ];
    
    return (
        <div className="ai-chat-container">
            <div className="chat-messages">
                {messages.map((message, index) => (
                    <div key={index} className={`message ${message.role}`}>
                        <div className="message-content">
                            {message.content}
                        </div>
                        
                        {/* Show quick actions for product search results */}
                        {message.metadata?.products && (
                            <div className="products-grid">
                                {message.metadata.products.map((product: Product) => (
                                    <div key={product.id} className="product-card">
                                        <h4>{product.title}</h4>
                                        <button 
                                            onClick={() => sendMessage(`Add ${product.title} to cart`)}
                                            disabled={loading}
                                        >
                                            Add to Cart
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* Show checkout button if available */}
                        {message.metadata?.checkout_url && (
                            <button 
                                className="checkout-button"
                                onClick={() => window.location.href = message.metadata.checkout_url}
                            >
                                Proceed to Checkout
                            </button>
                        )}
                    </div>
                ))}
                
                {loading && (
                    <div className="message assistant">
                        <div className="typing-indicator">AI is thinking...</div>
                    </div>
                )}
            </div>
            
            <form onSubmit={handleSubmit} className="chat-input-form">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask me about products, or say 'help' for examples..."
                    disabled={loading}
                    className="chat-input"
                />
                <button type="submit" disabled={loading || !input.trim()}>
                    Send
                </button>
            </form>
            
            <div className="quick-actions">
                {quickActions.map((action, index) => (
                    <button
                        key={index}
                        onClick={() => sendMessage(action)}
                        disabled={loading}
                        className="quick-action-button"
                    >
                        {action}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default AIChatComponent;
```

### Vue.js Component Example

```vue
<template>
  <div class="ai-chat-widget">
    <div class="chat-header">
      <h3>Shopping Assistant</h3>
      <span v-if="cartItemCount" class="cart-indicator">
        Cart: {{ cartItemCount }} items
      </span>
    </div>
    
    <div class="chat-messages" ref="messagesContainer">
      <div 
        v-for="(message, index) in messages" 
        :key="index" 
        :class="['message', message.role]"
      >
        <div class="message-content" v-html="formatMessage(message.content)"></div>
        
        <!-- Product recommendations -->
        <div v-if="message.metadata?.recommendations" class="recommendations">
          <h4>Recommended Products:</h4>
          <div class="product-list">
            <div 
              v-for="product in message.metadata.recommendations" 
              :key="product.id"
              class="product-item"
              @click="addToCart(product)"
            >
              <span class="product-title">{{ product.title }}</span>
              <span class="product-score">Score: {{ product.score }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <form @submit.prevent="sendMessage" class="chat-form">
      <input 
        v-model="currentMessage" 
        :disabled="loading"
        placeholder="Ask about products, prices, or say 'help'..."
        class="message-input"
      />
      <button type="submit" :disabled="loading || !currentMessage.trim()">
        {{ loading ? 'Sending...' : 'Send' }}
      </button>
    </form>
  </div>
</template>

<script>
export default {
  name: 'AIChatWidget',
  data() {
    return {
      messages: [
        {
          role: 'assistant',
          content: 'Hello! I\'m your shopping assistant. I can help you find products, manage your cart, and answer questions about our store. What are you looking for today?'
        }
      ],
      currentMessage: '',
      loading: false,
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      cartId: null,
      cartItemCount: 0
    };
  },
  props: {
    shop: {
      type: String,
      required: true
    },
    apiEndpoint: {
      type: String,
      default: '/api/chat'
    }
  },
  methods: {
    async sendMessage() {
      if (!this.currentMessage.trim() || this.loading) return;
      
      const userMessage = this.currentMessage;
      this.messages.push({ role: 'user', content: userMessage });
      this.currentMessage = '';
      this.loading = true;
      
      try {
        const response = await fetch(`${this.apiEndpoint}/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shop-Domain': this.shop
          },
          body: JSON.stringify({
            message: userMessage,
            session_id: this.sessionId,
            cart_id: this.cartId
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          this.messages.push({
            role: 'assistant',
            content: data.data.messages[0],
            metadata: data.data.metadata
          });
          
          // Update cart information
          if (data.data.metadata?.cart_id) {
            this.cartId = data.data.metadata.cart_id;
          }
          
          if (data.data.metadata?.total_items) {
            this.cartItemCount = data.data.metadata.total_items;
          }
        } else {
          throw new Error('Request failed');
        }
      } catch (error) {
        this.messages.push({
          role: 'assistant',
          content: 'I apologize, but I encountered an error. Please try again.'
        });
      } finally {
        this.loading = false;
        this.scrollToBottom();
      }
    },
    
    async addToCart(product) {
      const message = `Add ${product.title} to my cart`;
      this.currentMessage = message;
      await this.sendMessage();
    },
    
    formatMessage(content) {
      // Convert markdown-style formatting to HTML
      return content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
    },
    
    scrollToBottom() {
      this.$nextTick(() => {
        const container = this.$refs.messagesContainer;
        container.scrollTop = container.scrollHeight;
      });
    }
  }
};
</script>

<style scoped>
.ai-chat-widget {
  max-width: 400px;
  height: 500px;
  border: 1px solid #ddd;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  background: white;
}

.chat-header {
  padding: 10px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cart-indicator {
  background: #007cba;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.message {
  margin-bottom: 15px;
}

.message.user {
  text-align: right;
}

.message.user .message-content {
  background: #007cba;
  color: white;
  padding: 8px 12px;
  border-radius: 18px;
  display: inline-block;
  max-width: 80%;
}

.message.assistant .message-content {
  background: #f0f0f0;
  padding: 8px 12px;
  border-radius: 18px;
  display: inline-block;
  max-width: 90%;
}

.recommendations {
  margin-top: 10px;
  padding: 10px;
  background: #f9f9f9;
  border-radius: 8px;
}

.product-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.product-item {
  padding: 8px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
}

.product-item:hover {
  background: #f0f8ff;
}

.chat-form {
  padding: 10px;
  border-top: 1px solid #ddd;
  display: flex;
  gap: 8px;
}

.message-input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

button {
  padding: 8px 16px;
  background: #007cba;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
```

These examples demonstrate how to integrate the AI Agent's enhanced Shopify capabilities into various frontend frameworks and scenarios. The implementation provides a complete shopping experience through natural language interactions.