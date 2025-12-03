import OpenAI from 'openai';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';
import { SupabaseService } from './supabase.service';
import { ShopifyService } from './shopify.service';
import { EmbeddingService } from './embedding.service';
import { ConversionTrackingService } from './conversion-tracking.service';
import {
  AgentAction,
  AgentResponse,
  ChatMessage,
  AppError,
  ProductSearchFilters,
} from '@/types';

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
  private conversionTrackingService: ConversionTrackingService;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this.supabaseService = new SupabaseService();
    this.shopifyService = new ShopifyService();
    this.embeddingService = new EmbeddingService();
    this.conversionTrackingService = new ConversionTrackingService();
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
        hasCartId: !!cartId,
      });

      // 1. Analyze intent
      const intentAnalysis = await this.analyzeIntent(message);
      logger.debug('Intent analysis result:', intentAnalysis);

      // 2. Get conversation history for context
      const history = await this.supabaseService.getSessionHistory(
        sessionId,
        10
      );

      // 3. Process based on intent
      let response: AgentResponse;

      switch (intentAnalysis.intent) {
        case 'search_products':
          response = await this.handleProductSearch(
            message,
            shop,
            intentAnalysis
          );
          break;
        case 'add_to_cart':
          response = await this.handleAddToCart(
            message,
            shop,
            cartId,
            intentAnalysis
          );
          break;
        case 'view_cart':
          response = await this.handleViewCart(shop, cartId);
          break;
        case 'product_recommendation':
          response = await this.handleProductRecommendation(
            shop,
            cartId,
            intentAnalysis
          );
          break;
        case 'product_comparison':
          response = await this.handleProductComparison(
            message,
            shop,
            intentAnalysis
          );
          break;
        case 'general_inquiry':
          response = await this.handleGeneralInquiry(
            message,
            shop,
            history,
            context
          );
          break;
        default:
          response = await this.handleUnknownIntent(message, shop, history);
      }

      // 4. Save messages to conversation history and get message ID for tracking
      const messageId = await this.saveConversationTurn(
        sessionId,
        message,
        response.messages.join(' '),
        {
          intent: intentAnalysis.intent,
          confidence: intentAnalysis.confidence,
          actions_taken: response.actions.length,
        }
      );

      // 5. Track AI recommendations for conversion attribution
      try {
        await this.conversionTrackingService.trackAIRecommendations(
          sessionId,
          shop,
          response,
          messageId,
          context?.customerId,
          cartId
        );
      } catch (trackingError) {
        logger.error('Error tracking AI recommendations:', trackingError);
        // Don't fail the response if tracking fails
      }

      // 6. Update session activity
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
          { role: 'user', content: message },
        ],
        temperature: 0.1,
        max_tokens: 300,
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
        context: {},
      };
    }
  }

  private async handleProductSearch(
    message: string,
    shop: string,
    intentAnalysis: IntentAnalysis
  ): Promise<AgentResponse> {
    try {
      // Get store information to access tokens
      const store = await this.supabaseService.getStore(shop);
      if (!store) {
        throw new Error('Store not found');
      }

      // Extract search filters from intent analysis
      const keywords = intentAnalysis.entities.product_keywords || [];
      const searchQuery = keywords.length > 0 ? keywords.join(' ') : message;

      // Build search filters
      const searchFilters: ProductSearchFilters = {
        query: searchQuery,
        vendor: intentAnalysis.entities.vendor,
        productType:
          intentAnalysis.entities.category ||
          intentAnalysis.entities.product_type,
        tags: intentAnalysis.entities.tags,
        priceRange: intentAnalysis.entities.price_range,
        availability: true, // Only show available products
        sortKey: 'RELEVANCE',
        limit: 6,
      };

      // Search products using enhanced Shopify service
      const products = await this.shopifyService.searchProducts(
        shop,
        store.access_token,
        searchFilters,
        true // Use Storefront API for customer-facing searches
      );

      if (products.length === 0) {
        // Try semantic search as fallback
        try {
          const queryEmbedding =
            await this.embeddingService.generateEmbedding(searchQuery);
          const semanticResults = await this.supabaseService.searchProducts(
            shop,
            searchQuery,
            queryEmbedding,
            3
          );

          if (semanticResults.length > 0) {
            const productDescriptions = semanticResults
              .map((product, index) => {
                const price = product.variants?.[0]?.price || 'N/A';
                return `${index + 1}. **${product.title}** - $${price}
${product.description ? product.description.substring(0, 100) + '...' : ''}
*Relevance: ${(product.similarity * 100).toFixed(0)}%*`;
              })
              .join('\n\n');

            return {
              messages: [
                `I found ${semanticResults.length} products that might interest you:\n\n${productDescriptions}\n\nWould you like more details about any of these products or would you like me to add any to your cart?`,
              ],
              actions: [],
              metadata: {
                search_query: searchQuery,
                products_found: semanticResults.length,
                search_type: 'semantic',
                products: semanticResults.map(p => ({
                  id: p.id,
                  title: p.title,
                  handle: p.handle,
                })),
              },
            };
          }
        } catch (semanticError) {
          logger.warn('Semantic search fallback failed:', semanticError);
        }

        return {
          messages: [
            `I couldn't find any products matching "${searchQuery}". Could you try describing what you're looking for differently? For example, you could mention:\n• Brand or vendor name\n• Product category\n• Price range\n• Specific features you're looking for`,
          ],
          actions: [],
          metadata: {
            search_query: searchQuery,
            products_found: 0,
          },
        };
      }

      // Format product results for display with rich information
      const productDescriptions = products
        .map((product, index) => {
          const mainVariant = product.variants?.[0];
          const price = mainVariant?.price || 'N/A';
          const comparePrice = mainVariant?.compare_at_price;
          const priceDisplay =
            comparePrice && parseFloat(comparePrice) > parseFloat(price)
              ? `~~$${comparePrice}~~ $${price}`
              : `$${price}`;

          const availability =
            mainVariant?.inventory_quantity > 0
              ? '✅ In Stock'
              : '❌ Out of Stock';

          return `${index + 1}. **${product.title}** - ${priceDisplay}
${product.vendor ? `*By ${product.vendor}*\n` : ''}${product.description ? product.description.substring(0, 120) + '...' : ''}
${availability} | Product ID: ${product.id}`;
        })
        .join('\n\n');

      const response = `I found ${products.length} products that match your search for "${searchQuery}":\n\n${productDescriptions}\n\nTo add any product to your cart, just say "add [product name]" or "add product [number]". Would you like more details about any of these products?`;

      return {
        messages: [response],
        actions: [],
        metadata: {
          search_query: searchQuery,
          products_found: products.length,
          search_type: 'shopify_storefront',
          execution_time: Date.now(),
          products: products.map(p => ({
            id: p.id,
            title: p.title,
            handle: p.handle,
            variants: p.variants.map(v => ({ id: v.id, price: v.price })),
          })),
        },
      };
    } catch (error) {
      logger.error('Error handling product search:', error);
      return {
        messages: [
          'I had trouble searching for products. Please try again or contact support if the problem persists.',
        ],
        actions: [],
        metadata: { error: error.message },
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
      // Get store information
      const store = await this.supabaseService.getStore(shop);
      if (!store) {
        throw new Error('Store not found');
      }

      // Extract product information from the message/intent
      const productInfo = await this.extractProductFromMessage(
        message,
        shop,
        store.access_token
      );

      if (!productInfo) {
        return {
          messages: [
            'I need more information to add a product to your cart. Please specify:\n' +
              '• The product name or ID\n' +
              '• Quantity (optional, defaults to 1)\n\n' +
              'For example: "Add iPhone 14 to cart" or "Add product 1 from search results"',
          ],
          actions: [],
          metadata: {
            intent: 'add_to_cart',
            status: 'needs_clarification',
          },
        };
      }

      const quantity = intentAnalysis.entities.quantity || 1;
      const actions: AgentAction[] = [];

      if (!cartId) {
        // Create a new cart first
        actions.push({
          type: 'cart.create',
          params: {
            shop,
            buyerIdentity: intentAnalysis.entities.email
              ? { email: intentAnalysis.entities.email }
              : undefined,
          },
        });
      }

      // Add the product to cart
      actions.push({
        type: 'cart.add',
        params: {
          cartId: cartId || 'NEW_CART',
          variantId: productInfo.variantId,
          quantity: quantity,
          productTitle: productInfo.productTitle,
          variantTitle: productInfo.variantTitle,
          price: productInfo.price,
        },
      });

      const priceDisplay =
        productInfo.compareAtPrice &&
        parseFloat(productInfo.compareAtPrice) > parseFloat(productInfo.price)
          ? `~~$${productInfo.compareAtPrice}~~ $${productInfo.price}`
          : `$${productInfo.price}`;

      return {
        messages: [
          `Perfect! I've ${cartId ? 'added' : 'created your cart and added'} **${productInfo.productTitle}${productInfo.variantTitle && productInfo.variantTitle !== 'Default Title' ? ` - ${productInfo.variantTitle}` : ''}** to your cart.\n\n` +
            `💰 Price: ${priceDisplay}\n` +
            `📦 Quantity: ${quantity}\n\n` +
            `Would you like to:\n` +
            `• Continue shopping\n` +
            `• View your cart\n` +
            `• Proceed to checkout\n` +
            `• Get product recommendations?`,
        ],
        actions,
        metadata: {
          intent: 'add_to_cart',
          has_cart_id: !!cartId,
          product_id: productInfo.productId,
          variant_id: productInfo.variantId,
          quantity: quantity,
        },
      };
    } catch (error) {
      logger.error('Error handling add to cart:', error);
      return {
        messages: [
          "I had trouble adding the item to your cart. Please make sure you've specified a valid product and try again.",
        ],
        actions: [],
        metadata: { error: error.message },
      };
    }
  }

  private async extractProductFromMessage(
    message: string,
    shop: string,
    accessToken: string
  ): Promise<{
    productId: string;
    variantId: string;
    productTitle: string;
    variantTitle: string;
    price: string;
    compareAtPrice?: string;
  } | null> {
    try {
      // Try to extract product ID or product number from search results
      const productIdMatch = message.match(
        /product\s+(\d+)|id[:\s]+([a-zA-Z0-9_/-]+)/i
      );
      const productNumberMatch = message.match(
        /(?:add\s+)?(?:product\s+)?(\d+)(?:\s+to\s+cart)?/i
      );

      if (productIdMatch) {
        const productId = productIdMatch[1] || productIdMatch[2];
        const product = await this.shopifyService.getProduct(
          shop,
          accessToken,
          productId
        );
        if (product && product.variants.length > 0) {
          const variant = product.variants[0];
          return {
            productId: product.id,
            variantId: variant.id,
            productTitle: product.title,
            variantTitle: variant.title,
            price: variant.price,
            compareAtPrice: variant.compare_at_price,
          };
        }
      }

      // Try to search for the product by name
      const productNameMatch = message.match(/add\s+(.+?)(?:\s+to\s+cart|$)/i);
      if (productNameMatch) {
        const productName = productNameMatch[1].trim();
        const products = await this.shopifyService.searchProducts(
          shop,
          accessToken,
          { query: productName, limit: 1 },
          true
        );

        if (products.length > 0 && products[0].variants.length > 0) {
          const product = products[0];
          const variant = product.variants[0];
          return {
            productId: product.id,
            variantId: variant.id,
            productTitle: product.title,
            variantTitle: variant.title,
            price: variant.price,
            compareAtPrice: variant.compare_at_price,
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('Error extracting product from message:', error);
      return null;
    }
  }

  private async handleViewCart(
    shop: string,
    cartId?: string
  ): Promise<AgentResponse> {
    try {
      if (!cartId) {
        return {
          messages: [
            'Your cart is empty. Would you like me to help you find some products?',
          ],
          actions: [
            {
              type: 'product.search',
              params: { query: '', intent: 'browse' },
            },
          ],
          metadata: { cart_status: 'empty' },
        };
      }

      // Get store information
      const store = await this.supabaseService.getStore(shop);
      if (!store) {
        throw new Error('Store not found');
      }

      // Get cart details using Storefront API
      const cart = await this.shopifyService.getCart(
        shop,
        store.access_token,
        cartId
      );

      if (!cart || cart.lines.length === 0) {
        return {
          messages: [
            'Your cart is empty. Would you like me to help you find some products to add?',
          ],
          actions: [],
          metadata: {
            cart_status: 'empty',
            cart_id: cartId,
          },
        };
      }

      // Format cart items for display
      const cartItems = cart.lines
        .map((line: any, index: number) => {
          const merchandise = line.merchandise;
          const product = merchandise.product;
          const price = merchandise.price?.amount || '0';
          const total = (parseFloat(price) * line.quantity).toFixed(2);

          const options = merchandise.selectedOptions
            ?.filter(
              (opt: any) =>
                opt.name !== 'Title' && opt.value !== 'Default Title'
            )
            .map((opt: any) => `${opt.name}: ${opt.value}`)
            .join(', ');

          return `${index + 1}. **${product.title}**${options ? ` (${options})` : ''}
💰 $${price} × ${line.quantity} = $${total}
🏷️ Line ID: ${line.id}`;
        })
        .join('\n\n');

      const totalAmount = cart.cost?.totalAmount?.amount || '0';
      const subtotalAmount = cart.cost?.subtotalAmount?.amount || '0';

      // Calculate tax amount if total > subtotal
      const taxAmount = (
        parseFloat(totalAmount) - parseFloat(subtotalAmount)
      ).toFixed(2);

      const cartSummary =
        `🛒 **Your Cart** (${cart.totalQuantity} items)\n\n${cartItems}\n\n` +
        `💳 **Order Summary:**\n` +
        `• Subtotal: $${subtotalAmount}\n` +
        (parseFloat(taxAmount) > 0 ? `• Tax: $${taxAmount}\n` : '') +
        `• **Total: $${totalAmount}**\n\n` +
        `Would you like to:\n` +
        `• Continue shopping\n` +
        `• Remove an item (say "remove item [number]")\n` +
        `• Update quantities\n` +
        `• Proceed to checkout`;

      return {
        messages: [cartSummary],
        actions: [],
        metadata: {
          cart_id: cartId,
          cart_status: 'active',
          total_items: cart.totalQuantity,
          total_amount: totalAmount,
          checkout_url: cart.checkoutUrl,
          cart_lines: cart.lines.map((line: any) => ({
            id: line.id,
            quantity: line.quantity,
            variant_id: line.merchandise.id,
            product_title: line.merchandise.product.title,
          })),
        },
      };
    } catch (error) {
      logger.error('Error handling view cart:', error);
      return {
        messages: ['I had trouble accessing your cart. Please try again.'],
        actions: [],
        metadata: { error: error.message },
      };
    }
  }

  private async handleProductRecommendation(
    shop: string,
    cartId: string | undefined,
    intentAnalysis: IntentAnalysis
  ): Promise<AgentResponse> {
    try {
      // Get store information
      const store = await this.supabaseService.getStore(shop);
      if (!store) {
        throw new Error('Store not found');
      }

      let baseProductId: string | undefined;
      let recommendationIntent:
        | 'related'
        | 'complementary'
        | 'upsell'
        | 'popular' = 'popular';

      // Try to get context from cart if available
      if (cartId) {
        const cart = await this.shopifyService.getCart(
          shop,
          store.access_token,
          cartId
        );
        if (cart && cart.lines.length > 0) {
          // Use the most recent item in cart as base for recommendations
          const lastItem = cart.lines[cart.lines.length - 1];
          baseProductId = lastItem.merchandise.product.id;
          recommendationIntent = 'complementary';
        }
      }

      // Check if user specified a product for recommendations in their message
      const productMatch =
        intentAnalysis.entities.product_id ||
        intentAnalysis.entities.product_keywords?.[0];

      if (productMatch && !baseProductId) {
        // Try to find the product
        const products = await this.shopifyService.searchProducts(
          shop,
          store.access_token,
          { query: productMatch, limit: 1 },
          true
        );
        if (products.length > 0) {
          baseProductId = products[0].id;
          recommendationIntent = 'related';
        }
      }

      // Get recommendations using enhanced Shopify service
      const recommendations =
        await this.shopifyService.getProductRecommendations(
          shop,
          store.access_token,
          {
            productId: baseProductId,
            intent: recommendationIntent,
            limit: 4,
          }
        );

      if (recommendations.length === 0) {
        // Fallback to database recommendations if available
        try {
          const { data: dbRecommendations, error } = await (
            this.supabaseService as any
          ).serviceClient.rpc('get_product_recommendations', {
            shop_domain: shop,
            cart_product_ids: cartId ? [baseProductId].filter(Boolean) : [],
            recommendation_count: 3,
          });

          if (!error && dbRecommendations && dbRecommendations.length > 0) {
            const recList = dbRecommendations
              .map((product: any, index: number) => {
                const price =
                  product.variants?.[0]?.price || product.price || 'N/A';
                return `${index + 1}. **${product.title}** - $${price}
${product.description ? product.description.substring(0, 100) + '...' : ''}`;
              })
              .join('\n\n');

            return {
              messages: [
                `Based on popular products in the store, here are my recommendations:\n\n${recList}\n\nWould you like to add any of these to your cart or learn more about them?`,
              ],
              actions: [],
              metadata: {
                recommendations_found: dbRecommendations.length,
                recommendation_type: 'database_popular',
                source: 'fallback',
              },
            };
          }
        } catch (dbError) {
          logger.warn('Database recommendations fallback failed:', dbError);
        }

        return {
          messages: [
            cartId
              ? "I'd love to give you personalized recommendations! Let me know what type of products you're interested in, and I'll find similar items for you."
              : "I'd love to give you personalized recommendations! Once you add some items to your cart or tell me what you're looking for, I can suggest products that go well together.",
          ],
          actions: [],
          metadata: {
            recommendations_found: 0,
            base_product_id: baseProductId,
          },
        };
      }

      // Format recommendations for display
      const recList = recommendations
        .map((product, index) => {
          const mainVariant = product.variants?.[0];
          const price = mainVariant?.price || 'N/A';
          const comparePrice = mainVariant?.compare_at_price;
          const priceDisplay =
            comparePrice && parseFloat(comparePrice) > parseFloat(price)
              ? `~~$${comparePrice}~~ $${price}`
              : `$${price}`;

          const reason = product.reason || 'Recommended for you';

          return `${index + 1}. **${product.title}** - ${priceDisplay}
${product.vendor ? `*By ${product.vendor}*\n` : ''}${product.description ? product.description.substring(0, 100) + '...' : ''}
✨ ${reason} | Score: ${product.score || 0}`;
        })
        .join('\n\n');

      const contextMessage = baseProductId
        ? recommendationIntent === 'complementary'
          ? "Based on what's in your cart, here are products that go well together:"
          : "Here are products similar to what you're looking at:"
        : 'Here are some popular products you might like:';

      return {
        messages: [
          `${contextMessage}\n\n${recList}\n\nTo add any of these to your cart, just say "add [product name]" or "add product [number]". Would you like more details about any of these?`,
        ],
        actions: [],
        metadata: {
          recommendations_found: recommendations.length,
          recommendation_type: recommendationIntent,
          base_product_id: baseProductId,
          recommendations: recommendations.map(p => ({
            id: p.id,
            title: p.title,
            score: p.score,
            reason: p.reason,
          })),
        },
      };
    } catch (error) {
      logger.error('Error handling product recommendations:', error);
      return {
        messages: ['I had trouble getting recommendations. Please try again.'],
        actions: [],
        metadata: { error: error.message },
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
        "I can help you compare products! Please tell me which specific products you'd like to compare, " +
          "and I'll show you the key differences in features, prices, and customer reviews.",
      ],
      actions: [],
      metadata: {
        intent: 'product_comparison',
        status: 'awaiting_product_details',
      },
    };
  }

  private async handleGeneralInquiry(
    message: string,
    shop: string,
    history: ChatMessage[],
    context?: Record<string, any>
  ): Promise<AgentResponse> {
    try {
      const systemPrompt = `Eres Naay, una asesora de belleza natural con personalidad femenina y cercana ✨

      RESPUESTAS:
      - Máximo 150 caracteres
      - Tutea siempre, sé cálida y directa
      - Usa emojis naturales: ✨🌿💫🌸
      - Enfócate en cuidado natural de la piel
      
      Tu especialidad: productos naturales, rutinas personalizadas y consejos de belleza.
      Tienda: ${shop}
      `;

      const conversationContext = history
        .slice(-5)
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      const response = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Recent conversation:\n${conversationContext}\n\nCurrent question: ${message}`,
          },
        ],
        temperature: 0.8,
        max_tokens: 100,
      });

      const aiResponse =
        response.choices[0]?.message?.content ||
        '¡Estoy aquí para ayudarte! ✨ ¿Podrías preguntarme de otra forma?';

      return {
        messages: [aiResponse],
        actions: [],
        metadata: {
          intent: 'general_inquiry',
          response_type: 'ai_generated',
        },
      };
    } catch (error) {
      logger.error('Error handling general inquiry:', error);
      return {
        messages: [
          '¡Hola! ✨ Estoy aquí para ayudarte con nuestros productos y políticas. ¿Qué te gustaría saber?',
        ],
        actions: [],
        metadata: { error: error.message },
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
        '¡No estoy segura de lo que buscas, pero estoy aquí para ayudarte! ✨ ' +
          'Puedo ayudarte a encontrar productos, agregar a tu carrito o responder sobre la tienda. ' +
          '¿Qué te gustaría hacer? 🌿',
      ],
      actions: [],
      metadata: {
        intent: 'unknown',
        clarification_needed: true,
      },
    };
  }

  private async saveConversationTurn(
    sessionId: string,
    userMessage: string,
    agentResponse: string,
    metadata: Record<string, any>
  ): Promise<string | undefined> {
    try {
      // Save user message
      await this.supabaseService.saveChatMessage({
        session_id: sessionId,
        role: 'user',
        content: userMessage,
        metadata: { timestamp: new Date() },
      });

      // Save agent response and return its ID for tracking
      const assistantMessage = await this.supabaseService.saveChatMessage({
        session_id: sessionId,
        role: 'assistant',
        content: agentResponse,
        metadata: {
          ...metadata,
          timestamp: new Date(),
        },
      });

      return assistantMessage?.id;
    } catch (error) {
      logger.error('Error saving conversation turn:', error);
      // Don't throw here - conversation should continue even if saving fails
      return undefined;
    }
  }
}
