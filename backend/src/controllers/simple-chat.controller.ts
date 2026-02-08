import { Router, Request, Response, NextFunction } from 'express';
import OpenAI from 'openai';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';
import { SupabaseService } from '@/services/supabase.service';
import { tenantService } from '@/services/tenant.service';
import { createTenantRateLimiter } from '@/middleware/tenant.middleware';
import { SimpleConversionTracker } from '@/services/simple-conversion-tracker.service';

const router = Router();
const simpleConversionTracker = new SimpleConversionTracker();

// Per-tenant rate limiter (100 requests per minute per shop)
const tenantRateLimiter = createTenantRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
});

/**
 * Backwards-compatible tenant validation middleware
 * - If tenant exists: validates access and tracks usage
 * - If tenant doesn't exist: allows access (for existing stores like naay)
 */
const optionalTenantValidation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const shop = req.body?.shop;

    if (!shop) {
      // No shop provided, continue without tenant validation
      next();
      return;
    }

    // Try to get tenant info
    const tenant = await tenantService.getTenant(shop);

    if (tenant) {
      // Tenant exists - validate access
      try {
        await tenantService.validateTenantAccess(shop);

        // Attach tenant info to request for later use
        (req as any).tenant = tenant;

        // Record activity (non-blocking)
        tenantService.recordActivity(shop).catch(() => {});
      } catch (error: any) {
        // Tenant validation failed
        logger.warn('Tenant access denied', {
          shop,
          error: error.message,
        });

        const statusCode =
          error.metadata?.tenantErrorCode === 'USAGE_LIMIT_EXCEEDED'
            ? 429
            : 403;

        res.status(statusCode).json({
          success: false,
          error: error.message,
          data: {
            response: error.message,
            conversationId: null,
            ...(error.metadata?.tenantErrorCode === 'USAGE_LIMIT_EXCEEDED' && {
              contactEmail: tenant.shop_email || null,
            }),
          },
        });
        return;
      }
    } else {
      // No tenant record - this is an existing store without tenant setup
      // Allow access but log for tracking
      logger.debug('Shop without tenant record accessed', { shop });
    }

    next();
  } catch (error) {
    logger.error('Error in optionalTenantValidation:', error);
    // On error, allow access to not break existing functionality
    next();
  }
};

/**
 * Track message usage after successful response
 */
const trackUsageAfterResponse = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const originalJson = res.json.bind(res);

  res.json = (body: any) => {
    if (res.statusCode >= 200 && res.statusCode < 300 && body?.success) {
      const shop = req.body?.shop;
      if (shop) {
        // Invalidate monthly count cache so next validation gets fresh count
        tenantService.invalidateMessageCountCache(shop).catch(() => {});
      }
    }

    return originalJson(body);
  };

  next();
};

// Simple OpenAI client
const apiKey = process.env.OPENAI_API_KEY || config.openai?.apiKey;

logger.info('Simple Chat Controller initialized', {
  hasApiKey: !!apiKey,
  apiKeyLength: apiKey?.length || 0,
  configSource: process.env.OPENAI_API_KEY ? 'env' : 'config',
});

const openai = new OpenAI({
  apiKey: apiKey,
});

const supabaseService = new SupabaseService();

/**
 * Normalize shop domain to myshopify.com format
 * This ensures consistency between chat recommendations and order webhooks
 */
async function normalizeShopDomain(shopInput: string): Promise<string> {
  if (!shopInput) return shopInput;

  let normalized = shopInput.toLowerCase().trim();

  // If already in myshopify.com format, return as is
  if (normalized.includes('.myshopify.com')) {
    return normalized;
  }

  // Try to find the store by custom domain or name in our database
  const { data: store } = await (supabaseService as any).serviceClient
    .from('stores')
    .select('shop_domain')
    .or(`shop_domain.ilike.%${normalized}%,shop_domain.eq.${normalized}`)
    .limit(1)
    .single();

  if (store?.shop_domain) {
    return store.shop_domain;
  }

  // Also check client_stores
  const { data: clientStore } = await (supabaseService as any).serviceClient
    .from('client_stores')
    .select('shop_domain')
    .or(`shop_domain.ilike.%${normalized}%,shop_domain.eq.${normalized}`)
    .limit(1)
    .single();

  if (clientStore?.shop_domain) {
    return clientStore.shop_domain;
  }

  // Fallback: assume it's the shop name and add .myshopify.com
  // Handle cases like "naay.cl" -> try "naaycl.myshopify.com"
  const shopName = normalized.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/g, '');
  return `${shopName}.myshopify.com`;
}

// In-memory conversation store (for simple implementation)
// In production, this should use a proper database or cache
const conversationStore: Record<
  string,
  Array<{ role: string; content: string }>
> = {};

/**
 * Persist a chat message to the database for conversation history
 * Uses the existing chat_messages table
 */
async function persistChatMessage(
  sessionId: string,
  shopDomain: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  try {
    const { error } = await (supabaseService as any).serviceClient
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        shop_domain: shopDomain,
        role,
        content,
        timestamp: new Date().toISOString(),
      });

    if (error) {
      logger.warn('Failed to persist chat message:', { error, sessionId });
    }
  } catch (error) {
    logger.warn('Error persisting chat message:', { error, sessionId });
  }
}

// Function to search for products
async function searchProducts(
  shop: string,
  query: string,
  limit: number = 5,
  skinType?: string
) {
  try {
    logger.info('Function searchProducts called', {
      shop,
      query,
      limit,
      skinType,
    });

    const products = await supabaseService.searchProductsSemantic(
      shop,
      query,
      limit,
      { skinType }
    );

    return products.map(product => ({
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      vendor: product.vendor,
      productType: product.product_type,
      tags: product.tags,
      images: product.images?.[0] || null,
      available: product.variants?.some(v => v.available) || false,
      similarity: product.similarity,
    }));
  } catch (error) {
    logger.error('Error in searchProducts function:', error);
    return [];
  }
}

// Function to get product recommendations
async function getProductRecommendations(
  shop: string,
  skinType?: string,
  concerns?: string[],
  limit: number = 5
) {
  try {
    logger.info('Function getProductRecommendations called', {
      shop,
      skinType,
      concerns,
      limit,
    });

    let query = '';
    if (skinType) query += `productos para piel ${skinType} `;
    if (concerns && concerns.length > 0) query += concerns.join(' ') + ' ';
    if (!query.trim()) query = 'productos recomendados cuidado piel natural';

    const products = await supabaseService.searchProductsSemantic(
      shop,
      query.trim(),
      limit,
      { skinType }
    );

    return products.map(product => ({
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      vendor: product.vendor,
      productType: product.product_type,
      tags: product.tags,
      images: product.images?.[0] || null,
      available: product.variants?.some(v => v.available) || false,
      recommendationScore: product.similarity,
    }));
  } catch (error) {
    logger.error('Error in getProductRecommendations function:', error);
    return [];
  }
}

/**
 * GET /api/simple-chat/check?shop=xxx
 * Lightweight pre-check: can this tenant send a message?
 * Returns 200 if allowed, 429 if limit exceeded (with contactEmail).
 * Used by the widget before sending to external chat endpoints (e.g. n8n).
 */
router.get('/check', async (req: Request, res: Response) => {
  try {
    const shop = req.query.shop as string;
    if (!shop) {
      return res.json({ success: true, allowed: true });
    }

    const tenant = await tenantService.getTenant(shop);
    if (!tenant) {
      // No tenant record — allow (backwards-compat)
      return res.json({ success: true, allowed: true });
    }

    await tenantService.validateTenantAccess(shop);
    return res.json({ success: true, allowed: true });
  } catch (error: any) {
    if (error.metadata?.tenantErrorCode === 'USAGE_LIMIT_EXCEEDED') {
      // Look up tenant contact email
      let contactEmail: string | null = null;
      try {
        const shop = req.query.shop as string;
        const tenant = await tenantService.getTenant(shop);
        contactEmail = tenant?.shop_email || null;
      } catch {
        /* ignore */
      }

      return res.status(429).json({
        success: false,
        allowed: false,
        contactEmail,
      });
    }

    // Other tenant errors (suspended, etc.) — block
    return res.status(403).json({
      success: false,
      allowed: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/simple-chat/proxy
 * Proxy endpoint: validates tenant limits, then forwards to the tenant's
 * configured chatbot_endpoint (e.g. n8n). Returns the upstream response
 * transparently. If the tenant is over limit, returns a friendly message
 * in n8n-compatible format (HTTP 200) so the widget displays it normally.
 */
router.post('/proxy', async (req: Request, res: Response) => {
  try {
    const shop = req.body?.shop;

    if (!shop) {
      return res.status(400).json({ output: 'Error: shop is required' });
    }

    // 1. Validate tenant limits
    const tenant = await tenantService.getTenant(shop);
    if (tenant) {
      try {
        await tenantService.validateTenantAccess(shop);
      } catch (error: any) {
        if (error.metadata?.tenantErrorCode === 'USAGE_LIMIT_EXCEEDED') {
          const contactEmail = tenant.shop_email || null;
          const contactMsg = contactEmail
            ? ` Contáctanos a ${contactEmail} para más información.`
            : '';
          logger.info('Proxy: tenant limit exceeded, returning friendly message', { shop });
          return res.json({
            output: `Lo siento, nuestro sistema está temporalmente detenido.${contactMsg}`,
          });
        }
        // Suspended or other error
        return res.json({
          output: 'Lo siento, el servicio no está disponible en este momento.',
        });
      }
    }

    // 2. Look up the real chatbot endpoint for this shop
    const supabase = new SupabaseService();
    const { data: clientStore } = await (supabase as any).serviceClient
      .from('client_stores')
      .select('chatbot_endpoint')
      .eq('shop_domain', shop)
      .single();

    const targetUrl = clientStore?.chatbot_endpoint;
    if (!targetUrl) {
      logger.error('Proxy: no chatbot_endpoint configured', { shop });
      return res.json({ output: 'Error: chat no configurado para esta tienda.' });
    }

    // 3. Forward the original request to the real endpoint
    const upstreamResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    const upstreamData = await upstreamResponse.json();

    // 4. After successful response, invalidate cache for fresh count next time
    tenantService.invalidateMessageCountCache(shop).catch(() => {});

    return res.status(upstreamResponse.status).json(upstreamData);
  } catch (error) {
    logger.error('Proxy endpoint error:', error);
    return res.json({ output: 'Lo siento, hubo un error. Por favor intenta de nuevo.' });
  }
});

// Simple chat endpoint that directly connects to OpenAI
// Middlewares: rate limit per tenant -> validate tenant -> track usage
router.post(
  '/',
  tenantRateLimiter,
  optionalTenantValidation,
  trackUsageAfterResponse,
  async (req: Request, res: Response) => {
    try {
      const { message, shop: rawShop, conversationId } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Message is required',
        });
      }

      // Normalize shop domain to ensure consistency with webhooks
      const shop = rawShop ? await normalizeShopDomain(rawShop) : rawShop;

      // Generate conversation ID if not provided
      const currentConversationId =
        conversationId ||
        `simple_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logger.info('Simple chat message received', {
        shop: shop || 'unknown',
        rawShop: rawShop || 'unknown',
        conversationId: currentConversationId,
        messageLength: message.length,
        hasApiKey: !!apiKey,
        hasHistory: !!conversationStore[currentConversationId],
      });

      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      // Get or initialize conversation history
      if (!conversationStore[currentConversationId]) {
        conversationStore[currentConversationId] = [];
      }

      // Add current user message to conversation history
      conversationStore[currentConversationId].push({
        role: 'user',
        content: message,
      });

      // Persist user message to database (non-blocking)
      if (shop) {
        persistChatMessage(currentConversationId, shop, 'user', message).catch(
          () => {}
        );
      }

      // Keep conversation history manageable (last 20 messages)
      if (conversationStore[currentConversationId].length > 20) {
        conversationStore[currentConversationId] =
          conversationStore[currentConversationId].slice(-20);
      }

      // Prepare messages for OpenAI (system prompt + conversation history)
      const messages = [
        {
          role: 'system',
          content: `#### 💬 **Rol del Agente**

Eres **Naáy Assistant**, el asesor virtual de **Naáy**, marca española de cosmética natural y ecológica fundada en Valladolid. Tu misión es ofrecer orientación personalizada sobre el cuidado de la piel y el uso de productos Naáy, reflejando siempre el tono cálido, cercano, profesional y respetuoso con el medio ambiente que caracteriza a la marca.

---

#### 🌿 **Personalidad y tono**

* Cálido, empático y educativo
* Profesional, pero accesible
* Natural y confiable, sin tecnicismos excesivos
* Inspirado en el bienestar y respeto por el cuerpo y la naturaleza

Ejemplo de tono:

> "Tu piel merece respirar y sentirse en calma. Te ayudaré a elegir una rutina que la cuide con ingredientes naturales, como hacemos en Naáy desde hace más de una década."

---

#### 🧴 **Conocimientos base**

* Cosmética natural y ecológica certificada (sin parabenos, siliconas, derivados del petróleo, alcohol ni sales).
* Tipos de piel: seca, grasa, mixta, sensible, con dermatitis, rosácea, psoriasis, etc.
* Ingredientes naturales comunes en los productos Naáy (aloe vera, manzanilla, caléndula, rosa mosqueta, etc.).
* Beneficios dermatológicos de cada línea de producto (facial, corporal, capilar, bebés, higiene personal).
* Certificaciones ecológicas europeas y valores éticos (no testado en animales, sostenibilidad).

---

#### 🪄 **Funciones principales**

1. **Asesor dermatológico personalizado:** recomendar productos según tipo de piel, edad y necesidades.
2. **Educador ecológico:** explicar la importancia de los ingredientes naturales y las certificaciones ecológicas.
3. **Asistente de compra:** guiar al usuario en el proceso de elección y uso correcto de cada producto.
4. **Embajador de marca:** transmitir los valores de respeto al cuerpo, a la familia y al medio ambiente.
5. **Atención postventa:** resolver dudas sobre combinaciones, alergias o rutinas.

---

#### 🧠 **Estructura de razonamiento**

Cuando un usuario interactúe:

1. Identifica su **tipo de piel** y necesidades (sensibilidad, hidratación, regeneración, etc.).
2. Sugiere una rutina **personalizada** (limpieza, hidratación, nutrición, protección).
3. Explica **por qué** se recomiendan esos productos y **qué los hace diferentes**.
4. Ofrece un consejo ecológico o de bienestar complementario.

---

#### ⚙️ **Ejemplo de diálogo**

**Usuario:** Tengo la piel muy sensible y últimamente me arde con cualquier crema. ¿Qué puedo usar?
**Naáy Assistant:** Entiendo lo molesto que puede ser. En Naáy formulamos productos especialmente para pieles como la tuya, con ingredientes naturales calmantes como aloe vera y caléndula. Te recomiendo nuestra **Crema Facial Calmante de Aloe & Caléndula**, libre de alcohol y parabenos, ideal para reducir la irritación y fortalecer la barrera natural de tu piel. 🌿

---

#### 🌍 **Valores esenciales**

* Respeto al cuerpo y la naturaleza.
* Cuidado de toda la familia.
* Innovación basada en experiencia (más de 18 años en cosmética ecológica).
* Colaboración con hospitales y asociaciones dermatológicas.
* Producción sostenible y ética.

**INSTRUCCIONES CRÍTICAS:**

🚨 **SOLO PRODUCTOS REALES**: NUNCA inventes, menciones o recomiendes productos que no existan en el catálogo actual de Shopify. SIEMPRE debes buscar en la base de datos de productos reales antes de hacer cualquier recomendación.

🔍 **OBLIGATORIO**: Antes de responder cualquier consulta sobre productos, DEBES usar las herramientas disponibles (search_products o get_product_recommendations) para buscar productos reales que coincidan con las necesidades del usuario.

❌ **PROHIBIDO**: 
- Inventar nombres de productos que no existen
- Crear descripciones de productos inexistentes
- Mencionar productos "ejemplo" o "hipotéticos"
- Sugerir productos sin verificar que existan en stock

✅ **PERMITIDO**:
- Solo recomendar productos que aparezcan en los resultados de búsqueda
- Explicar beneficios de ingredientes naturales en general
- Dar consejos de cuidado de la piel sin mencionar productos específicos si no hay coincidencias en la base de datos
- Sugerir que el usuario reformule su consulta si no encuentras productos adecuados

🛠️ **USO DE HERRAMIENTAS OBLIGATORIO**:
- Para consultas como "¿tienes cremas para piel seca?" → Usar search_products con query="crema piel seca"
- Para preguntas como "¿qué me recomiendas para mi piel grasa?" → Usar get_product_recommendations con skin_type="grasa"
- Para dudas específicas como "productos anti-edad" → Usar search_products con query="anti-edad"
- SIEMPRE usar las herramientas antes de responder sobre productos específicos

**Si no encuentras productos reales que coincidan con la consulta, explica que no tienes productos específicos disponibles actualmente y ofrece consejos generales de cuidado de la piel.**`,
        },
        ...conversationStore[currentConversationId], // Include conversation history
      ];

      // Define tools for product search
      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'search_products',
            description:
              'Busca productos específicos en el catálogo de Shopify basado en una consulta de texto',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description:
                    "Término de búsqueda para encontrar productos (ej: 'crema facial', 'limpiador', 'anti-edad')",
                },
                skin_type: {
                  type: 'string',
                  description:
                    "Tipo de piel del usuario (ej: 'seca', 'grasa', 'mixta', 'sensible')",
                  enum: ['seca', 'grasa', 'mixta', 'sensible', 'normal'],
                },
                limit: {
                  type: 'number',
                  description: 'Número máximo de productos a devolver',
                  default: 5,
                },
              },
              required: ['query'],
            },
          },
        },
        {
          type: 'function' as const,
          function: {
            name: 'get_product_recommendations',
            description:
              'Obtiene recomendaciones de productos basadas en el tipo de piel y preocupaciones específicas',
            parameters: {
              type: 'object',
              properties: {
                skin_type: {
                  type: 'string',
                  description: 'Tipo de piel del usuario',
                  enum: ['seca', 'grasa', 'mixta', 'sensible', 'normal'],
                },
                concerns: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                  description:
                    "Lista de preocupaciones de la piel (ej: ['anti-edad', 'acné', 'manchas'])",
                },
                limit: {
                  type: 'number',
                  description: 'Número máximo de productos a recomendar',
                  default: 3,
                },
              },
            },
          },
        },
      ];

      // Call OpenAI with tools
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages,
        tools: tools,
        tool_choice: 'auto',
        max_tokens: 500,
        temperature: 0.7,
      });

      let response =
        completion.choices[0]?.message?.content ||
        '¡Hola! Soy tu asistente de Naay. ¿En qué puedo ayudarte con tu cuidado de la piel?';

      // Handle function calls
      if (completion.choices[0]?.message?.tool_calls) {
        const toolCalls = completion.choices[0].message.tool_calls;
        let toolResults: any[] = [];
        let allRecommendedProducts: any[] = []; // Track all products for conversion tracking

        for (const toolCall of toolCalls) {
          if (toolCall.function.name === 'search_products') {
            const args = JSON.parse(toolCall.function.arguments);
            const products = await searchProducts(
              shop,
              args.query,
              args.limit,
              args.skin_type
            );
            allRecommendedProducts.push(...products);
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              content: JSON.stringify(products),
            });
          } else if (toolCall.function.name === 'get_product_recommendations') {
            const args = JSON.parse(toolCall.function.arguments);
            const products = await getProductRecommendations(
              shop,
              args.skin_type,
              args.concerns,
              args.limit
            );
            allRecommendedProducts.push(...products);
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              content: JSON.stringify(products),
            });
          }
        }

        // Track product recommendations for conversion attribution
        if (allRecommendedProducts.length > 0 && shop) {
          const now = new Date();
          for (const product of allRecommendedProducts) {
            if (product.id) {
              try {
                await simpleConversionTracker.trackRecommendation({
                  sessionId: currentConversationId,
                  shopDomain: shop,
                  productId: product.id.toString(),
                  productTitle: product.title || 'Unknown Product',
                  recommendedAt: now,
                });
              } catch (trackError) {
                logger.warn('Failed to track recommendation:', {
                  productId: product.id,
                  error: trackError,
                });
              }
            }
          }
          logger.info('Product recommendations tracked for conversion', {
            shop,
            conversationId: currentConversationId,
            productsTracked: allRecommendedProducts.length,
          });
        }

        // If we have tool results, make another call to get the final response
        if (toolResults.length > 0) {
          const messagesWithTools = [
            ...messages,
            completion.choices[0].message,
            ...toolResults,
          ];

          const finalCompletion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: messagesWithTools,
            max_tokens: 500,
            temperature: 0.7,
          });

          response = finalCompletion.choices[0]?.message?.content || response;
        }
      }

      // Store assistant's response in conversation history
      conversationStore[currentConversationId].push({
        role: 'assistant',
        content: response,
      });

      // Persist assistant response to database (non-blocking)
      if (shop) {
        persistChatMessage(
          currentConversationId,
          shop,
          'assistant',
          response
        ).catch(() => {});
      }

      res.json({
        success: true,
        data: {
          response,
          conversationId: currentConversationId, // Return the same conversation ID
        },
      });
    } catch (error: any) {
      logger.error('Simple chat error:', {
        message: error?.message,
        type: error?.constructor?.name,
        status: error?.status,
        code: error?.code,
        hasApiKey: !!apiKey,
      });

      // Specific error handling for OpenAI issues
      let errorMessage =
        'Lo siento, hubo un problema al procesar tu mensaje. Por favor intenta de nuevo.';

      if (error?.message?.includes('API key')) {
        errorMessage =
          'Error de configuración del servicio. Por favor contacta al administrador.';
      } else if (error?.status === 401) {
        errorMessage = 'Error de autenticación con el servicio de IA.';
      } else if (error?.status === 429) {
        errorMessage =
          'El servicio está muy ocupado. Por favor intenta en unos momentos.';
      }

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        data: {
          response: errorMessage,
          conversationId: null,
          debug:
            process.env.NODE_ENV === 'development'
              ? {
                  hasApiKey: !!apiKey,
                  errorType: error?.constructor?.name,
                  errorMessage: error?.message,
                }
              : undefined,
        },
      });
    }
  }
);

// Test endpoint to check OpenAI configuration
router.get('/test', async (req: Request, res: Response) => {
  try {
    logger.info('Testing OpenAI configuration');

    if (!apiKey) {
      return res.json({
        success: false,
        error: 'OpenAI API key not configured',
        hasApiKey: false,
      });
    }

    // Simple test call
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 10,
    });

    res.json({
      success: true,
      message: 'OpenAI API is working correctly',
      hasApiKey: true,
      testResponse: completion.choices[0]?.message?.content,
    });
  } catch (error: any) {
    logger.error('OpenAI test failed:', error);

    res.json({
      success: false,
      error: error?.message || 'Unknown error',
      hasApiKey: !!apiKey,
      errorType: error?.constructor?.name,
      status: error?.status,
    });
  }
});

// Debug endpoint to check configuration and CORS
router.get('/debug', async (req: Request, res: Response) => {
  try {
    const envVars = {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      HAS_OPENAI_KEY: !!process.env.OPENAI_API_KEY,
      OPENAI_KEY_LENGTH: process.env.OPENAI_API_KEY?.length || 0,
      HAS_SUPABASE_URL: !!process.env.SUPABASE_URL,
      HAS_SHOPIFY_KEY: !!process.env.SHOPIFY_API_KEY,
    };

    const corsHeaders = {
      'Access-Control-Allow-Origin': res.getHeader(
        'Access-Control-Allow-Origin'
      ),
      'Access-Control-Allow-Methods': res.getHeader(
        'Access-Control-Allow-Methods'
      ),
      'Access-Control-Allow-Headers': res.getHeader(
        'Access-Control-Allow-Headers'
      ),
    };

    const requestInfo = {
      method: req.method,
      url: req.url,
      origin: req.get('Origin'),
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type'),
    };

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: envVars,
      cors: corsHeaders,
      request: requestInfo,
      apiKeyConfigured: !!apiKey,
      apiKeySource: process.env.OPENAI_API_KEY ? 'env' : 'config',
    });
  } catch (error: any) {
    logger.error('Debug endpoint error:', error);

    res.status(500).json({
      success: false,
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Debug endpoint to verify CORS and environment configuration
router.get('/debug', async (req: Request, res: Response) => {
  try {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-Requested-With',
    });

    res.json({
      success: true,
      environment: process.env.NODE_ENV,
      hasOpenAIKey: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      corsHeaders: {
        origin: req.headers.origin,
        method: req.method,
        userAgent: req.headers['user-agent'],
      },
      timestamp: new Date().toISOString(),
      azureInfo: {
        websiteSiteName: process.env.WEBSITE_SITE_NAME,
        websiteInstanceId: process.env.WEBSITE_INSTANCE_ID,
      },
    });
  } catch (error: any) {
    logger.error('Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/chat/persist
 * Persist chat messages to the database
 * Used by widget when using external chat endpoints (like n8n)
 */
router.post('/persist', async (req: Request, res: Response) => {
  try {
    const { sessionId, shopDomain, messages } = req.body;

    if (!sessionId || !shopDomain || !messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sessionId, shopDomain, messages',
      });
    }

    logger.info('Persisting chat messages', {
      sessionId,
      shopDomain,
      messageCount: messages.length,
    });

    // Persist each message
    for (const msg of messages) {
      if (msg.role && msg.content) {
        await persistChatMessage(
          sessionId,
          shopDomain,
          msg.role as 'user' | 'assistant',
          msg.content
        );
      }
    }

    res.json({
      success: true,
      persisted: messages.length,
    });
  } catch (error: any) {
    logger.error('Error persisting messages:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
