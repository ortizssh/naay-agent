import { Router, Request, Response, NextFunction } from 'express';
import OpenAI from 'openai';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';
import { SupabaseService } from '@/services/supabase.service';
import { tenantService } from '@/services/tenant.service';
import { createTenantRateLimiter } from '@/middleware/tenant.middleware';
import { SimpleConversionTracker } from '@/services/simple-conversion-tracker.service';
import { knowledgeService } from '@/services/knowledge.service';
import {
  getCommerceProvider,
  registerCommerceProvider,
  StoreCredentials,
} from '@/platforms/interfaces/commerce.interface';
// Side-effect imports to register commerce providers
import '@/platforms/woocommerce';

// Register Shopify commerce provider adapter (uses REST Admin API directly)
registerCommerceProvider('shopify', (credentials: StoreCredentials) => {
  const accessToken = credentials.access_token || '';
  const apiVersion = '2024-01';

  async function shopifyRest(shop: string, endpoint: string): Promise<any> {
    const url = `https://${shop}/admin/api/${apiVersion}/${endpoint}`;
    const res = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok)
      throw new Error(`Shopify API ${res.status}: ${res.statusText}`);
    return res.json();
  }

  function normalizeProduct(p: any) {
    return {
      id: p.id,
      external_id: p.id,
      title: p.title,
      description: (p.body_html || '')
        .replace(/<[^>]*>/g, '')
        .substring(0, 300),
      handle: p.handle,
      vendor: p.vendor,
      product_type: p.product_type,
      tags:
        typeof p.tags === 'string'
          ? p.tags
              .split(',')
              .map((t: string) => t.trim())
              .filter(Boolean)
          : p.tags || [],
      images: (p.images || []).map((img: any) => ({ src: img.src })),
      variants: (p.variants || []).map((v: any) => ({
        id: v.id,
        external_id: v.id,
        title: v.title,
        price: Number(v.price) || 0,
        available: v.inventory_quantity > 0,
        sku: v.sku,
      })),
      price_range: { min: Number(p.variants?.[0]?.price) || 0 },
    };
  }

  return {
    searchProducts: async (shop: string, filters: any) => {
      const query = filters.query || '';
      const limit = Math.min(filters.limit || 5, 10);
      const data = await shopifyRest(
        shop,
        `products.json?limit=${limit}&status=active&title=${encodeURIComponent(query)}`
      );
      const products = (data.products || []).map(normalizeProduct);
      // If title search returned nothing, try broader search
      if (products.length === 0 && query) {
        const allData = await shopifyRest(
          shop,
          `products.json?limit=50&status=active`
        );
        const queryLower = query.toLowerCase();
        const filtered = (allData.products || []).filter((p: any) => {
          const text =
            `${p.title} ${p.body_html || ''} ${p.tags || ''} ${p.product_type || ''}`.toLowerCase();
          return queryLower
            .split(/\s+/)
            .some((word: string) => word.length > 2 && text.includes(word));
        });
        return filtered.slice(0, limit).map(normalizeProduct);
      }
      return products;
    },
    getProduct: async (shop: string, productId: string) => {
      try {
        const data = await shopifyRest(shop, `products/${productId}.json`);
        return data.product ? normalizeProduct(data.product) : null;
      } catch {
        return null;
      }
    },
    getProductRecommendations: async (shop: string, options: any) => {
      const limit = Math.min(options.limit || 5, 10);
      const intent = options.intent || 'popular';
      const data = await shopifyRest(
        shop,
        `products.json?limit=${limit}&status=active`
      );
      return (data.products || []).map(normalizeProduct);
    },
  } as any;
});

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

  // Strip protocol (https://imperionfc.cl → imperionfc.cl)
  normalized = normalized.replace(/^https?:\/\//, '');
  // Strip trailing slash
  normalized = normalized.replace(/\/+$/, '');

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
 * Transcribe audio using OpenAI Whisper API
 */
async function transcribeAudio(
  base64Data: string,
  mimeType: string
): Promise<string> {
  const buffer = Buffer.from(base64Data, 'base64');
  const extMap: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/webm;codecs=opus': 'webm',
  };
  const ext = extMap[mimeType] || 'webm';
  // Use OpenAI's toFile helper for buffer-to-file conversion
  const { toFile: openaiToFile } = await import('openai/uploads');
  const file = await openaiToFile(buffer, `audio.${ext}`, { type: mimeType });
  const result = await (openai as any).audio.transcriptions.create({
    model: 'whisper-1',
    file,
    language: 'es',
  });
  return result.text;
}

/**
 * Persist a chat message to the database for conversation history
 * Uses the existing chat_messages table
 */
async function persistChatMessage(
  sessionId: string,
  shopDomain: string,
  role: 'client' | 'agent',
  content: string,
  metadata?: Record<string, string>
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
        ...(metadata && Object.keys(metadata).length > 0 && { metadata }),
      });

    if (error) {
      logger.warn('Failed to persist chat message:', { error, sessionId });
    }
  } catch (error) {
    logger.warn('Error persisting chat message:', { error, sessionId });
  }
}

// =====================================================
// Default system prompt (used as fallback when tenant has no custom config)
// =====================================================
const DEFAULT_SYSTEM_PROMPT = `Eres un asistente virtual de comercio. Tu misión es ayudar a los clientes a encontrar productos y resolver sus dudas.

INSTRUCCIONES CRÍTICAS:
- SIEMPRE usa search_products antes de recomendar productos
- NUNCA inventes productos que no existan en el catálogo
- Usa search_knowledge para preguntas sobre la marca, políticas, envíos, etc.
- Si no encuentras productos adecuados, ofrece consejos generales y sugiere reformular la consulta
- Los productos se mostrarán como tarjetas visuales con imagen, precio y botón de compra. Tu texto debe ser un párrafo breve de recomendación, NO un listado detallado de productos con precios.
- Menciona los productos por nombre de forma natural en tu recomendación, pero no repitas precios ni descripciones extensas.`;

// Tone descriptions for system prompt generation
const TONE_DESCRIPTIONS: Record<string, string> = {
  friendly: 'Cálido, cercano y empático. Usa un lenguaje natural y accesible.',
  formal: 'Formal y respetuoso. Usa un lenguaje profesional y cortés.',
  casual: 'Casual y relajado. Usa un lenguaje informal y directo.',
  professional:
    'Profesional y experto. Usa un lenguaje técnico pero comprensible.',
};

const LANGUAGE_NAMES: Record<string, string> = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
};

/**
 * Build a dynamic system prompt from tenant AI config
 */
function buildSystemPrompt(agentConfig: {
  agent_name?: string;
  brand_description?: string;
  agent_tone?: string;
  agent_language?: string;
  agent_instructions?: string;
  widget_brand_name?: string;
}): string {
  const name =
    agentConfig.agent_name || agentConfig.widget_brand_name || 'Asistente';
  const brandName = agentConfig.widget_brand_name || 'la tienda';
  const tone =
    TONE_DESCRIPTIONS[agentConfig.agent_tone || 'friendly'] ||
    TONE_DESCRIPTIONS.friendly;
  const language =
    LANGUAGE_NAMES[agentConfig.agent_language || 'es'] || 'Español';

  let prompt = `Eres ${name}, el asistente virtual de ${brandName}.`;

  if (agentConfig.brand_description) {
    prompt += `\n\n${agentConfig.brand_description}`;
  }

  prompt += `\n\nTONO: ${tone}`;
  prompt += `\nIDIOMA: Responde siempre en ${language}.`;

  if (agentConfig.agent_instructions) {
    prompt += `\n\nINSTRUCCIONES ADICIONALES:\n${agentConfig.agent_instructions}`;
  }

  prompt += `\n\nHERRAMIENTAS DISPONIBLES:
- search_products: busca productos en el catálogo actualizado de la tienda
- get_product_recommendations: obtiene recomendaciones de productos
- get_product_details: obtiene detalle completo de un producto específico
- search_knowledge: consulta la base de conocimiento de la marca (políticas, envíos, info de marca, etc.)

REGLAS CRÍTICAS:
- SIEMPRE usa search_products antes de recomendar productos específicos
- NUNCA inventes productos que no existan en el catálogo
- Usa search_knowledge para preguntas sobre la marca, políticas, envíos, etc.
- Solo recomienda productos que aparezcan en los resultados de búsqueda
- Si no encuentras productos adecuados, ofrece consejos generales y sugiere reformular la consulta

FORMATO DE RESPUESTA:
- Tu respuesta de texto NO debe superar los 350 caracteres. Sé breve, directa y conversacional.
- Recomienda MÁXIMO 3 productos por respuesta.
- Los productos se mostrarán automáticamente como tarjetas visuales con imagen, precio y botón de compra.
- Tu texto debe ser un párrafo breve y natural de recomendación, NO un listado con precios ni descripciones extensas.
- Menciona los productos por nombre de forma conversacional. Ejemplo: "Te recomiendo la Tarjeta NFC Metálica Black, ideal para networking profesional."
- No repitas la información que ya aparecerá en las tarjetas (precio, imagen, botón).`;

  return prompt;
}

/**
 * Load AI config for a tenant from client_stores
 */
async function loadAgentConfig(shopDomain: string): Promise<{
  agent_name?: string;
  agent_tone?: string;
  brand_description?: string;
  agent_instructions?: string;
  agent_language?: string;
  ai_model?: string;
  chat_mode?: string;
  widget_brand_name?: string;
  platform?: string;
  access_token?: string;
} | null> {
  try {
    const { data, error } = await (supabaseService as any).serviceClient
      .from('client_stores')
      .select(
        'agent_name, agent_tone, brand_description, agent_instructions, agent_language, ai_model, chat_mode, widget_brand_name, platform, access_token'
      )
      .eq('shop_domain', shopDomain)
      .eq('chat_mode', 'internal')
      .limit(1);
    if (data && data.length > 0) return data[0];

    // Fallback: get any row for this shop
    const { data: fallback, error: fallbackErr } = await (
      supabaseService as any
    ).serviceClient
      .from('client_stores')
      .select(
        'agent_name, agent_tone, brand_description, agent_instructions, agent_language, ai_model, chat_mode, widget_brand_name, platform, access_token'
      )
      .eq('shop_domain', shopDomain)
      .limit(1);
    return fallback?.[0] || null;
  } catch (err: any) {
    logger.warn('loadAgentConfig error', { shopDomain, error: err.message });
    return null;
  }
}

// Function to search products via commerce provider (real-time API)
async function searchProductsViaProvider(
  shop: string,
  query: string,
  limit: number = 5,
  provider: any | null
) {
  try {
    logger.info('searchProducts via commerce provider', { shop, query, limit });

    // Try real-time API first if provider is available
    if (provider) {
      try {
        const products = await provider.searchProducts(shop, {
          query,
          limit,
          availability: true,
        });
        if (products && products.length > 0) {
          return products.map((p: any) => ({
            id: p.external_id || p.id,
            title: p.title,
            description: p.description?.substring(0, 300) || '',
            price: p.price_range?.min || p.variants?.[0]?.price || 'N/A',
            vendor: p.vendor || '',
            productType: p.product_type || '',
            tags: p.tags || [],
            images: p.images?.[0]?.src || null,
            available:
              p.variants?.some((v: any) => v.available !== false) ?? true,
            handle: p.handle || '',
          }));
        }
      } catch (providerError) {
        logger.warn(
          'Commerce provider search failed, falling back to semantic:',
          providerError
        );
      }
    }

    // Fallback: semantic search via embeddings
    const products = await supabaseService.searchProductsSemantic(
      shop,
      query,
      limit
    );
    return products.map(product => ({
      id: product.id,
      title: product.title,
      description: product.description?.substring(0, 300) || '',
      price: product.price,
      vendor: product.vendor,
      productType: product.product_type,
      tags: product.tags,
      images: product.images?.[0] || null,
      available: product.variants?.some(v => v.available) || false,
      similarity: product.similarity,
    }));
  } catch (error) {
    logger.error('Error in searchProducts:', error);
    return [];
  }
}

// Function to get product recommendations via commerce provider
async function getProductRecommendationsViaProvider(
  shop: string,
  intent: string,
  limit: number = 5,
  provider: any | null
) {
  try {
    logger.info('getProductRecommendations via commerce provider', {
      shop,
      intent,
      limit,
    });

    if (provider) {
      try {
        const products = await provider.getProductRecommendations(shop, {
          intent: (intent as any) || 'popular',
          limit,
        });
        if (products && products.length > 0) {
          return products.map((p: any) => ({
            id: p.external_id || p.id,
            title: p.title,
            description: p.description?.substring(0, 300) || '',
            price: p.price_range?.min || p.variants?.[0]?.price || 'N/A',
            vendor: p.vendor || '',
            tags: p.tags || [],
            images: p.images?.[0]?.src || null,
            available: true,
            reason: p.reason || '',
          }));
        }
      } catch (providerError) {
        logger.warn(
          'Commerce provider recommendations failed, falling back to semantic:',
          providerError
        );
      }
    }

    // Fallback: semantic search
    const query = intent || 'productos populares recomendados';
    const products = await supabaseService.searchProductsSemantic(
      shop,
      query,
      limit
    );
    return products.map(product => ({
      id: product.id,
      title: product.title,
      description: product.description?.substring(0, 300) || '',
      price: product.price,
      vendor: product.vendor,
      tags: product.tags,
      images: product.images?.[0] || null,
      available: product.variants?.some(v => v.available) || false,
    }));
  } catch (error) {
    logger.error('Error in getProductRecommendations:', error);
    return [];
  }
}

// Function to get product details via commerce provider
async function getProductDetailsViaProvider(
  shop: string,
  productId: string,
  provider: any | null
) {
  try {
    if (provider) {
      const product = await provider.getProduct(shop, productId);
      if (product) {
        return {
          id: product.external_id || product.id,
          title: product.title,
          description: product.description || '',
          vendor: product.vendor || '',
          productType: product.product_type || '',
          tags: product.tags || [],
          images: product.images?.map((img: any) => img.src) || [],
          variants:
            product.variants?.map((v: any) => ({
              id: v.external_id || v.id,
              title: v.title,
              price: v.price,
              available: v.available !== false,
              sku: v.sku || '',
            })) || [],
          handle: product.handle || '',
        };
      }
    }
    return null;
  } catch (error) {
    logger.error('Error getting product details:', error);
    return null;
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
    const rawShop = req.query.shop as string;
    if (!rawShop) {
      return res.json({ success: true, allowed: true });
    }

    // Normalize domain (e.g. "https://imperionfc.cl" → "imperionfc.cl")
    const shop = await normalizeShopDomain(rawShop);

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
        const rawShop = req.query.shop as string;
        const shop = await normalizeShopDomain(rawShop);
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

// Simple chat endpoint that directly connects to OpenAI
// Middlewares: rate limit per tenant -> validate tenant -> track usage
router.post(
  '/',
  tenantRateLimiter,
  optionalTenantValidation,
  trackUsageAfterResponse,
  async (req: Request, res: Response) => {
    try {
      const { message, shop: rawShop, conversationId, attachment } = req.body;

      // Validate: need either a text message or an attachment
      if ((!message || typeof message !== 'string') && !attachment) {
        return res.status(400).json({
          success: false,
          error: 'Message or attachment is required',
        });
      }

      // Validate attachment if present
      if (attachment) {
        if (!attachment.type || !['image', 'audio'].includes(attachment.type)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid attachment type. Must be "image" or "audio".',
          });
        }
        if (!attachment.data || typeof attachment.data !== 'string') {
          return res
            .status(400)
            .json({ success: false, error: 'Attachment data is required.' });
        }
        // Size limits: ~2.7MB base64 for images (~2MB raw), ~6.7MB base64 for audio (~5MB raw)
        const maxBase64 = attachment.type === 'image' ? 2_800_000 : 6_800_000;
        if (attachment.data.length > maxBase64) {
          return res.status(400).json({
            success: false,
            error: `Attachment too large (max ${attachment.type === 'image' ? '2MB' : '5MB'}).`,
          });
        }
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
        messageLength: message?.length || 0,
        hasApiKey: !!apiKey,
        hasHistory: !!conversationStore[currentConversationId],
      });

      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      // Load tenant AI config for dynamic system prompt & model
      const agentConfig = shop ? await loadAgentConfig(shop) : null;
      const aiModel = agentConfig?.ai_model || 'gpt-4.1-mini';
      // Build system prompt: dynamic if config exists, default otherwise
      const systemPrompt = agentConfig
        ? buildSystemPrompt(agentConfig)
        : DEFAULT_SYSTEM_PROMPT;

      // Initialize commerce provider for real-time product API calls
      let commerceProvider: any = null;
      if (shop) {
        try {
          // Load access_token, credentials, and site_url from stores table (canonical source)
          let accessToken = agentConfig?.access_token;
          let credentials: any = null;
          let siteUrl: string | null = null;
          const { data: storeData } = await (
            supabaseService as any
          ).serviceClient
            .from('stores')
            .select('access_token, credentials, site_url')
            .eq('shop_domain', shop)
            .limit(1);
          if (storeData?.[0]) {
            if (!accessToken) accessToken = storeData[0].access_token;
            credentials = storeData[0].credentials;
            siteUrl = storeData[0].site_url;
          }
          const platform = (agentConfig?.platform || 'shopify') as any;
          if (
            accessToken ||
            (credentials?.consumer_key && credentials?.consumer_secret)
          ) {
            commerceProvider = getCommerceProvider(platform, {
              platform,
              access_token: accessToken,
              consumer_key: credentials?.consumer_key,
              consumer_secret: credentials?.consumer_secret,
              siteUrl:
                siteUrl ||
                (platform === 'woocommerce' ? `https://${shop}` : undefined),
            });
          }
        } catch (providerErr) {
          logger.warn('Could not initialize commerce provider:', providerErr);
        }
      }

      // Get or initialize conversation history
      if (!conversationStore[currentConversationId]) {
        conversationStore[currentConversationId] = [];
      }

      // Process attachment (audio transcription / image prep)
      let userTextForHistory = message || '';
      let transcription: string | undefined;
      let imageBase64: string | undefined;
      let audioUrl: string | undefined;
      let imageUrl: string | undefined;

      if (attachment?.type === 'audio') {
        try {
          transcription = await transcribeAudio(
            attachment.data,
            attachment.mimeType || 'audio/webm'
          );
          userTextForHistory = transcription;
          logger.info('Audio transcribed successfully', {
            length: transcription.length,
          });
        } catch (err: any) {
          logger.error('Whisper transcription failed:', err);
          return res.status(500).json({
            success: false,
            error: 'Error al transcribir el audio. Por favor intenta de nuevo.',
            data: {
              response:
                'No se pudo transcribir el audio. Por favor intenta de nuevo.',
              conversationId: currentConversationId,
            },
          });
        }

        // Upload audio to Supabase Storage (non-blocking on failure)
        try {
          const audioBuffer = Buffer.from(attachment.data, 'base64');
          const audioMime = attachment.mimeType || 'audio/webm';
          audioUrl = await supabaseService.uploadChatFile(
            'chat-audio',
            shop || 'unknown',
            currentConversationId,
            audioBuffer,
            audioMime
          );
        } catch (uploadErr) {
          logger.warn(
            'Audio upload to Storage failed, continuing without URL:',
            uploadErr
          );
        }
      } else if (attachment?.type === 'image') {
        imageBase64 = attachment.data;
        userTextForHistory = message
          ? `[Imagen enviada] ${message}`
          : '[Imagen enviada]';

        // Upload image to Supabase Storage (non-blocking on failure)
        try {
          const imageBuffer = Buffer.from(attachment.data, 'base64');
          imageUrl = await supabaseService.uploadChatFile(
            'chat-images',
            shop || 'unknown',
            currentConversationId,
            imageBuffer,
            'image/jpeg'
          );
        } catch (uploadErr) {
          logger.warn(
            'Image upload to Storage failed, continuing without URL:',
            uploadErr
          );
        }
      }

      // Add current user message to conversation history (text-only for context)
      conversationStore[currentConversationId].push({
        role: 'user',
        content: userTextForHistory,
      });

      // Persist user message to database (non-blocking) — include IP/user-agent for conversion attribution
      if (shop) {
        const clientIp =
          (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
          req.ip ||
          '';
        const clientUa = req.headers['user-agent'] || '';
        const msgMetadata: Record<string, string> = {};
        if (clientIp) msgMetadata['x-forwarded-for'] = clientIp;
        if (clientUa) msgMetadata['user-agent'] = clientUa;

        persistChatMessage(
          currentConversationId,
          shop,
          'client',
          userTextForHistory,
          msgMetadata
        ).catch(() => {});
      }

      // Keep conversation history manageable (last 20 messages)
      if (conversationStore[currentConversationId].length > 20) {
        conversationStore[currentConversationId] =
          conversationStore[currentConversationId].slice(-20);
      }

      // Prepare messages for OpenAI (system prompt + conversation history)
      // History goes as text; only the LAST message gets multimodal content if image
      const historyMessages = conversationStore[currentConversationId];
      const messages: any[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
      ];

      // Add all history except the last message
      for (let i = 0; i < historyMessages.length - 1; i++) {
        messages.push(historyMessages[i]);
      }

      // Last message: multimodal if image, otherwise text
      if (imageBase64) {
        messages.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                message ||
                'Describe esta imagen y ayúdame a encontrar productos similares.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'low',
              },
            },
          ],
        });
      } else {
        messages.push(historyMessages[historyMessages.length - 1]);
      }

      // Define tools for product search + knowledge base
      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'search_products',
            description:
              'Busca productos en el catálogo actualizado de la tienda basado en una consulta de texto',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description:
                    "Término de búsqueda para encontrar productos (ej: 'crema facial', 'limpiador', 'anti-edad')",
                },
                limit: {
                  type: 'number',
                  description:
                    'Número máximo de productos a devolver (default: 3, max: 3)',
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
              'Obtiene recomendaciones de productos según una intención o necesidad',
            parameters: {
              type: 'object',
              properties: {
                intent: {
                  type: 'string',
                  description:
                    "Intención o descripción de lo que busca el cliente (ej: 'productos para piel sensible', 'regalos populares')",
                },
                limit: {
                  type: 'number',
                  description:
                    'Número máximo de productos a recomendar (default: 3, max: 3)',
                },
              },
              required: ['intent'],
            },
          },
        },
        {
          type: 'function' as const,
          function: {
            name: 'get_product_details',
            description:
              'Obtiene el detalle completo de un producto específico (variantes, precios, stock)',
            parameters: {
              type: 'object',
              properties: {
                product_id: {
                  type: 'string',
                  description: 'ID del producto a consultar',
                },
              },
              required: ['product_id'],
            },
          },
        },
        {
          type: 'function' as const,
          function: {
            name: 'search_knowledge',
            description:
              'Consulta la base de conocimiento de la marca para responder preguntas sobre políticas, envíos, información de la marca, ingredientes, etc.',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description:
                    "Pregunta o tema a buscar en la base de conocimiento (ej: 'política de devoluciones', 'envíos internacionales')",
                },
                limit: {
                  type: 'number',
                  description: 'Número máximo de resultados (default: 5)',
                },
              },
              required: ['query'],
            },
          },
        },
      ];

      // Call OpenAI with tools
      const completion = await openai.chat.completions.create({
        model: aiModel,
        messages: messages,
        tools: tools,
        tool_choice: 'auto',
        max_tokens: 500,
        temperature: 0.7,
      });

      let response =
        completion.choices[0]?.message?.content ||
        '¡Hola! ¿En qué puedo ayudarte?';

      // Handle function calls
      let allRecommendedProducts: any[] = [];
      if (completion.choices[0]?.message?.tool_calls) {
        const toolCalls = completion.choices[0].message.tool_calls;
        let toolResults: any[] = [];

        for (const toolCall of toolCalls) {
          const args = JSON.parse(toolCall.function.arguments);

          if (toolCall.function.name === 'search_products') {
            const products = await searchProductsViaProvider(
              shop,
              args.query,
              Math.min(args.limit || 3, 3),
              commerceProvider
            );
            allRecommendedProducts.push(...products);
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              content: JSON.stringify(products),
            });
          } else if (toolCall.function.name === 'get_product_recommendations') {
            const products = await getProductRecommendationsViaProvider(
              shop,
              args.intent,
              Math.min(args.limit || 3, 3),
              commerceProvider
            );
            allRecommendedProducts.push(...products);
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              content: JSON.stringify(products),
            });
          } else if (toolCall.function.name === 'get_product_details') {
            const product = await getProductDetailsViaProvider(
              shop,
              args.product_id,
              commerceProvider
            );
            if (product) allRecommendedProducts.push(product);
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              content: JSON.stringify(
                product || { error: 'Product not found' }
              ),
            });
          } else if (toolCall.function.name === 'search_knowledge') {
            const results = shop
              ? await knowledgeService.searchKnowledge(
                  shop,
                  args.query,
                  args.limit || 5
                )
              : [];
            logger.info('search_knowledge', {
              shop,
              query: args.query,
              resultCount: results.length,
            });
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              content: JSON.stringify(
                results.map(r => ({
                  title: r.document_title,
                  content: r.content,
                  similarity: r.similarity,
                }))
              ),
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
            model: aiModel,
            messages: messagesWithTools,
            max_tokens: 500,
            temperature: 0.7,
          });

          response = finalCompletion.choices[0]?.message?.content || response;
        }
      }

      // Store assistant's response in conversation history (clean text for OpenAI context)
      conversationStore[currentConversationId].push({
        role: 'assistant',
        content: response,
      });

      // Cap products to max 3 before sending to widget
      allRecommendedProducts = allRecommendedProducts.slice(0, 3);

      // Build widget response: append product JSON so the widget renders product cards
      // Format matches n8n output: {"output":[{"product":{id,title,image:{src},price,handle,variant_id}}]}
      let widgetResponse = response;
      if (allRecommendedProducts.length > 0) {
        const widgetProducts = allRecommendedProducts
          .filter((p: any) => p.id && p.title)
          .map((p: any) => {
            // Resolve image URL from various formats
            let imageUrl = '';
            if (typeof p.images === 'string') {
              imageUrl = p.images;
            } else if (Array.isArray(p.images) && p.images.length > 0) {
              imageUrl =
                typeof p.images[0] === 'string'
                  ? p.images[0]
                  : p.images[0]?.src || '';
            }

            // Resolve price from direct field or variants array
            let price = 0;
            if (p.price && p.price !== 'N/A') {
              price = Number(p.price) || 0;
            } else if (p.variants && p.variants.length > 0) {
              price = Number(p.variants[0].price) || 0;
            }

            // Resolve variant ID
            const variantId =
              p.variantId ||
              (p.variants && p.variants.length > 0 ? p.variants[0].id : null) ||
              p.id;

            return {
              product: {
                id: isNaN(Number(p.id)) ? p.id : Number(p.id),
                title: p.title,
                image: imageUrl ? { src: imageUrl } : { src: '' },
                price,
                handle: p.handle || '',
                variant_id: isNaN(Number(variantId))
                  ? variantId
                  : Number(variantId),
              },
            };
          });

        if (widgetProducts.length > 0) {
          widgetResponse =
            response +
            '\n\n' +
            JSON.stringify({ output: widgetProducts }, null, 2);
        }
      }

      // Persist assistant response to database (non-blocking) — includes product JSON
      if (shop) {
        persistChatMessage(
          currentConversationId,
          shop,
          'agent',
          widgetResponse
        ).catch(() => {});
      }

      res.json({
        success: true,
        data: {
          response: widgetResponse,
          conversationId: currentConversationId,
          ...(transcription && { transcription }),
          ...(audioUrl && { audioUrl }),
          ...(imageUrl && { imageUrl }),
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
        // Map OpenAI roles to our DB convention if needed
        const dbRole =
          msg.role === 'user'
            ? 'client'
            : msg.role === 'assistant'
              ? 'agent'
              : (msg.role as 'client' | 'agent');
        await persistChatMessage(sessionId, shopDomain, dbRole, msg.content);
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
