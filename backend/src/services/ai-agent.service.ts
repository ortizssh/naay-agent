import OpenAI from 'openai';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';
import { SupabaseService } from './supabase.service';
import { ShopifyService } from './shopify.service';
import { EmbeddingService } from './embedding.service';
import { AgentAction, AgentResponse, ChatMessage, AppError } from '@/types';

interface IntentAnalysis {
  intent: string;
  confidence: number;
  entities: Record<string, any>;
  context: Record<string, any>;
}

export class AIAgentService {
  private openai: OpenAI;
  private supabaseService: SupabaseService;
  private shopifyService: ShopifyService;
  private embeddingService: EmbeddingService;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this.supabaseService = new SupabaseService();
    this.shopifyService = new ShopifyService();
    this.embeddingService = new EmbeddingService();
  }

  async processMessage(
    message: string,
    sessionId: string,
    shop: string,
    cartId?: string,
    context?: Record<string, any>
  ): Promise<AgentResponse> {
    try {
      logger.info(`Processing message for session: ${sessionId}`, {
        shop,
        messageLength: message.length,
        hasCartId: !!cartId
      });

      // 1. Analyze intent
      const intentAnalysis = await this.analyzeIntent(message);
      logger.debug('Intent analysis result:', intentAnalysis);

      // 2. Get conversation history for context
      const history = await this.supabaseService.getSessionHistory(sessionId, 10);

      // 3. Process based on intent
      let response: AgentResponse;
      
      switch (intentAnalysis.intent) {
        case 'search_products':
          response = await this.handleProductSearch(message, shop, intentAnalysis);
          break;
        case 'add_to_cart':
          response = await this.handleAddToCart(message, shop, cartId, intentAnalysis);
          break;
        case 'view_cart':
          response = await this.handleViewCart(shop, cartId);
          break;
        case 'product_recommendation':
          response = await this.handleProductRecommendation(shop, cartId, intentAnalysis);
          break;
        case 'product_comparison':
          response = await this.handleProductComparison(message, shop, intentAnalysis);
          break;
        case 'general_inquiry':
          response = await this.handleGeneralInquiry(message, shop, history, context);
          break;
        default:
          response = await this.handleUnknownIntent(message, shop, history);
      }

      // 4. Save messages to conversation history
      await this.saveConversationTurn(sessionId, message, response.messages.join(' '), {
        intent: intentAnalysis.intent,
        confidence: intentAnalysis.confidence,
        actions_taken: response.actions.length
      });

      // 5. Update session activity
      await this.supabaseService.updateSessionActivity(sessionId);

      return response;

    } catch (error) {
      logger.error('Error processing message:', error);
      throw new AppError(`Failed to process message: ${error.message}`, 500);
    }
  }

  private async analyzeIntent(message: string): Promise<IntentAnalysis> {
    try {
      const systemPrompt = `You are an AI intent classifier for an e-commerce chat assistant. Analyze the user's message and respond with ONLY a JSON object in this exact format:

{
  "intent": "one of: search_products|add_to_cart|view_cart|product_recommendation|product_comparison|general_inquiry|unknown",
  "confidence": 0.95,
  "entities": {
    "product_keywords": ["keyword1", "keyword2"],
    "quantity": 1,
    "color": "red",
    "size": "M",
    "price_range": {"min": 10, "max": 50}
  },
  "context": {
    "urgency": "low|medium|high",
    "customer_type": "new|returning"
  }
}

Intent definitions:
- search_products: Looking for specific products or browsing
- add_to_cart: Wants to add specific items to cart  
- view_cart: Wants to see cart contents
- product_recommendation: Asking for suggestions/recommendations
- product_comparison: Comparing multiple products
- general_inquiry: Questions about policies, shipping, etc.
- unknown: Cannot determine intent

Extract relevant entities from the message and provide confidence score (0-1).`;

      const response = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.1,
        max_tokens: 300
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const analysis = JSON.parse(content);
      
      // Validate the response structure
      if (!analysis.intent || typeof analysis.confidence !== 'number') {
        throw new Error('Invalid intent analysis format');
      }

      return analysis;

    } catch (error) {
      logger.error('Error analyzing intent:', error);
      // Fallback to unknown intent
      return {
        intent: 'unknown',
        confidence: 0.1,
        entities: {},
        context: {}
      };
    }
  }

  private async handleProductSearch(
    message: string, 
    shop: string, 
    intentAnalysis: IntentAnalysis
  ): Promise<AgentResponse> {
    try {
      // Extract search keywords
      const keywords = intentAnalysis.entities.product_keywords || [];
      const searchQuery = keywords.length > 0 ? keywords.join(' ') : message;

      // Generate embedding for search
      const queryEmbedding = await this.embeddingService.generateEmbedding(searchQuery);

      // Search products using semantic search
      const products = await this.supabaseService.searchProducts(shop, searchQuery, queryEmbedding, 5);

      if (products.length === 0) {
        return {
          messages: [`I couldn't find any products matching "${searchQuery}". Could you try describing what you're looking for differently?`],
          actions: [],
          metadata: {
            search_query: searchQuery,
            products_found: 0
          }
        };
      }

      // Format product results for display
      const productDescriptions = products.map((product, index) => {
        return `${index + 1}. **${product.title}** - $${product.price}
${product.description ? product.description.substring(0, 100) + '...' : ''}
*Similarity: ${(product.similarity * 100).toFixed(0)}%*`;
      }).join('\n\n');

      const response = `I found ${products.length} products that match your search for "${searchQuery}":

${productDescriptions}

Would you like more details about any of these products or would you like me to add any to your cart?`;

      return {
        messages: [response],
        actions: [],
        metadata: {
          search_query: searchQuery,
          products_found: products.length,
          execution_time: Date.now()
        }
      };

    } catch (error) {
      logger.error('Error handling product search:', error);
      return {
        messages: ['I had trouble searching for products. Please try again.'],
        actions: [],
        metadata: { error: error.message }
      };
    }
  }

  private async handleAddToCart(
    message: string,
    shop: string,
    cartId: string | undefined,
    intentAnalysis: IntentAnalysis
  ): Promise<AgentResponse> {
    try {
      // For now, return a helpful message about cart functionality
      // This will be implemented with Storefront API integration
      
      const actions: AgentAction[] = [];
      
      if (cartId) {
        // In future implementation, this would:
        // 1. Extract product ID from message/intent
        // 2. Get product variants
        // 3. Add to cart via Storefront API
        
        actions.push({
          type: 'cart.add',
          params: {
            cartId,
            // variantId: extractedVariantId,
            // quantity: intentAnalysis.entities.quantity || 1
          }
        });
      }

      return {
        messages: [
          'I understand you want to add something to your cart. Let me help you with that! ' +
          'Please let me know which specific product you\'d like to add, and I\'ll take care of it for you.'
        ],
        actions,
        metadata: {
          intent: 'add_to_cart',
          has_cart_id: !!cartId
        }
      };

    } catch (error) {
      logger.error('Error handling add to cart:', error);
      return {
        messages: ['I had trouble adding items to your cart. Please try again.'],
        actions: [],
        metadata: { error: error.message }
      };
    }
  }

  private async handleViewCart(shop: string, cartId?: string): Promise<AgentResponse> {
    try {
      if (!cartId) {
        return {
          messages: ['Your cart is empty. Would you like me to help you find some products?'],
          actions: [],
          metadata: { cart_status: 'empty' }
        };
      }

      // In future implementation, this would fetch cart via Storefront API
      return {
        messages: [
          'Let me check your cart for you. Cart functionality is currently being set up - ' +
          'you\'ll be able to view and manage your cart items very soon!'
        ],
        actions: [],
        metadata: {
          cart_id: cartId,
          cart_status: 'pending_implementation'
        }
      };

    } catch (error) {
      logger.error('Error handling view cart:', error);
      return {
        messages: ['I had trouble accessing your cart. Please try again.'],
        actions: [],
        metadata: { error: error.message }
      };
    }
  }

  private async handleProductRecommendation(
    shop: string,
    cartId: string | undefined,
    intentAnalysis: IntentAnalysis
  ): Promise<AgentResponse> {
    try {
      // Get recommendations based on cart or popular products
      const { data: recommendations, error } = await (this.supabaseService as any).serviceClient
        .rpc('get_product_recommendations', {
          shop_domain: shop,
          cart_product_ids: [], // Would extract from cart in future
          recommendation_count: 3
        });

      if (error || !recommendations || recommendations.length === 0) {
        return {
          messages: [
            'I\'d love to give you personalized recommendations! ' +
            'Once you add some items to your cart, I can suggest products that go well together.'
          ],
          actions: [],
          metadata: { recommendations_found: 0 }
        };
      }

      const recList = recommendations.map((product: any, index: number) => {
        return `${index + 1}. **${product.title}** - $${product.price}
${product.description ? product.description.substring(0, 80) + '...' : ''}`;
      }).join('\n\n');

      return {
        messages: [
          `Based on popular products, here are my recommendations for you:\n\n${recList}\n\nWould you like to know more about any of these?`
        ],
        actions: [],
        metadata: {
          recommendations_found: recommendations.length,
          recommendation_type: 'popular'
        }
      };

    } catch (error) {
      logger.error('Error handling product recommendations:', error);
      return {
        messages: ['I had trouble getting recommendations. Please try again.'],
        actions: [],
        metadata: { error: error.message }
      };
    }
  }

  private async handleProductComparison(
    message: string,
    shop: string,
    intentAnalysis: IntentAnalysis
  ): Promise<AgentResponse> {
    return {
      messages: [
        'I can help you compare products! Please tell me which specific products you\'d like to compare, ' +
        'and I\'ll show you the key differences in features, prices, and customer reviews.'
      ],
      actions: [],
      metadata: {
        intent: 'product_comparison',
        status: 'awaiting_product_details'
      }
    };
  }

  private async handleGeneralInquiry(
    message: string,
    shop: string,
    history: ChatMessage[],
    context?: Record<string, any>
  ): Promise<AgentResponse> {
    try {
      const systemPrompt = `You are a helpful customer service assistant for an e-commerce store. 
      
      Provide helpful, friendly responses about:
      - Shipping policies and times
      - Return and exchange policies  
      - Product care instructions
      - Store policies
      - General shopping help

      Keep responses concise but helpful. If you don't know specific store policies, say so and suggest they contact customer support.
      
      Store context: ${shop}
      `;

      const conversationContext = history.slice(-5).map(msg => 
        `${msg.role}: ${msg.content}`
      ).join('\n');

      const response = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Recent conversation:\n${conversationContext}\n\nCurrent question: ${message}` }
        ],
        temperature: 0.7,
        max_tokens: 300
      });

      const aiResponse = response.choices[0]?.message?.content || 
        'I\'m here to help! Could you please rephrase your question?';

      return {
        messages: [aiResponse],
        actions: [],
        metadata: {
          intent: 'general_inquiry',
          response_type: 'ai_generated'
        }
      };

    } catch (error) {
      logger.error('Error handling general inquiry:', error);
      return {
        messages: [
          'I\'m here to help with any questions about our products or policies. ' +
          'What would you like to know?'
        ],
        actions: [],
        metadata: { error: error.message }
      };
    }
  }

  private async handleUnknownIntent(
    message: string,
    shop: string,
    history: ChatMessage[]
  ): Promise<AgentResponse> {
    return {
      messages: [
        'I\'m not quite sure what you\'re looking for, but I\'m here to help! ' +
        'I can help you find products, add items to your cart, or answer questions about our store. ' +
        'What would you like to do?'
      ],
      actions: [],
      metadata: {
        intent: 'unknown',
        clarification_needed: true
      }
    };
  }

  private async saveConversationTurn(
    sessionId: string,
    userMessage: string,
    agentResponse: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      // Save user message
      await this.supabaseService.saveChatMessage({
        session_id: sessionId,
        role: 'user',
        content: userMessage,
        metadata: { timestamp: new Date() }
      });

      // Save agent response
      await this.supabaseService.saveChatMessage({
        session_id: sessionId,
        role: 'assistant',
        content: agentResponse,
        metadata: {
          ...metadata,
          timestamp: new Date()
        }
      });

    } catch (error) {
      logger.error('Error saving conversation turn:', error);
      // Don't throw here - conversation should continue even if saving fails
    }
  }
}