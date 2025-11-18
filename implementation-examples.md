# Implementation Examples - Naay Agent Backend

## 1. OAuth Service Implementation

```typescript
// src/services/auth/oauth.service.ts
import { Shop } from '../../models/database/shop.model';
import { ShopService } from '../database/shop.service';

export class OAuthService {
  constructor(
    private shopService: ShopService,
    private supabase: SupabaseClient
  ) {}

  generateInstallUrl(shop: string): string {
    const scopes = [
      'read_products',
      'read_product_listings', 
      'write_products',
      'read_orders',
      'write_orders',
      'read_customers'
    ].join(',');

    const params = new URLSearchParams({
      client_id: process.env.SHOPIFY_API_KEY!,
      scope: scopes,
      redirect_uri: process.env.SHOPIFY_REDIRECT_URI!,
      state: this.generateState(shop),
      'grant_options[]': 'per-user'
    });

    return `https://${shop}/admin/oauth/authorize?${params}`;
  }

  async exchangeCodeForToken(
    shop: string, 
    code: string, 
    state: string
  ): Promise<{ accessToken: string; scopes: string[] }> {
    // Verify state parameter
    if (!this.verifyState(state, shop)) {
      throw new AppError('Invalid state parameter', ErrorType.AUTHENTICATION, 401);
    }

    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY!,
        client_secret: process.env.SHOPIFY_API_SECRET!,
        code
      })
    });

    if (!response.ok) {
      throw new AppError('Failed to exchange code for token', ErrorType.EXTERNAL_API, 400);
    }

    const data = await response.json();
    
    // Save shop to database
    await this.shopService.upsert({
      domain: shop,
      access_token: data.access_token,
      scopes: data.scope.split(','),
      created_at: new Date(),
      updated_at: new Date(),
      is_active: true
    });

    return {
      accessToken: data.access_token,
      scopes: data.scope.split(',')
    };
  }

  private generateState(shop: string): string {
    const payload = { shop, timestamp: Date.now() };
    return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '10m' });
  }

  private verifyState(state: string, shop: string): boolean {
    try {
      const decoded = jwt.verify(state, process.env.JWT_SECRET!) as any;
      return decoded.shop === shop;
    } catch {
      return false;
    }
  }
}
```

## 2. Shopify Admin API Service

```typescript
// src/services/shopify/admin-api.service.ts
export class ShopifyAdminAPIService {
  constructor(private shop: Shop) {}

  async getProducts(options: {
    first?: number;
    after?: string;
    query?: string;
  } = {}): Promise<{ products: Product[]; pageInfo: PageInfo }> {
    const query = `
      query getProducts($first: Int, $after: String, $query: String) {
        products(first: $first, after: $after, query: $query) {
          nodes {
            id
            title
            description
            descriptionHtml
            handle
            vendor
            productType
            tags
            status
            createdAt
            updatedAt
            images(first: 10) {
              nodes {
                id
                url
                altText
                width
                height
              }
            }
            variants(first: 100) {
              nodes {
                id
                title
                sku
                price
                compareAtPrice
                inventoryQuantity
                availableForSale
                selectedOptions {
                  name
                  value
                }
                image {
                  url
                  altText
                }
              }
            }
            seo {
              title
              description
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;

    try {
      const response = await this.graphqlRequest(query, {
        first: options.first || 50,
        after: options.after,
        query: options.query
      });

      return {
        products: response.data.products.nodes,
        pageInfo: response.data.products.pageInfo
      };
    } catch (error) {
      throw new AppError(
        `Failed to fetch products: ${error.message}`,
        ErrorType.EXTERNAL_API,
        500
      );
    }
  }

  async getProductById(productId: string): Promise<Product | null> {
    const query = `
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          title
          description
          descriptionHtml
          handle
          vendor
          productType
          tags
          status
          createdAt
          updatedAt
          images(first: 10) {
            nodes {
              id
              url
              altText
              width
              height
            }
          }
          variants(first: 100) {
            nodes {
              id
              title
              sku
              price
              compareAtPrice
              inventoryQuantity
              availableForSale
              selectedOptions {
                name
                value
              }
              image {
                url
                altText
              }
            }
          }
        }
      }
    `;

    const response = await this.graphqlRequest(query, { id: productId });
    return response.data.product;
  }

  private async graphqlRequest(query: string, variables?: any): Promise<any> {
    const response = await fetch(`https://${this.shop.domain}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.shop.access_token
      },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result;
  }
}
```

## 3. AI Orchestrator Service

```typescript
// src/services/ai/orchestrator.service.ts
export class AIOrchestrator {
  constructor(
    private intentService: IntentService,
    private ragService: RAGService,
    private actionService: ActionService,
    private cartService: CartService
  ) {}

  async processMessage(input: {
    message: string;
    sessionId: string;
    shopId: string;
    cartId?: string;
    userId?: string;
    conversationHistory: Message[];
  }): Promise<{
    response: string;
    actions: Action[];
    cartId?: string;
    confidence: number;
  }> {
    try {
      // 1. Detect intent
      const intent = await this.intentService.detectIntent({
        message: input.message,
        context: {
          sessionId: input.sessionId,
          shopId: input.shopId,
          cartId: input.cartId,
          conversationHistory: input.conversationHistory
        }
      });

      // 2. Gather context using RAG if needed
      let context = '';
      if (intent.requiresProductKnowledge) {
        const ragResults = await this.ragService.searchProducts({
          query: input.message,
          shopId: input.shopId,
          limit: 5,
          threshold: 0.7
        });
        context = this.formatProductContext(ragResults);
      }

      // 3. Generate AI response
      const aiResponse = await this.generateResponse({
        message: input.message,
        intent,
        context,
        conversationHistory: input.conversationHistory,
        shopId: input.shopId
      });

      // 4. Parse and validate actions
      const actions = await this.actionService.parseActions(aiResponse.actions);
      const validatedActions = await this.actionService.validateActions(actions, {
        shopId: input.shopId,
        cartId: input.cartId
      });

      // 5. Execute actions
      const executionResults = await this.executeActions(validatedActions, {
        shopId: input.shopId,
        cartId: input.cartId,
        sessionId: input.sessionId
      });

      return {
        response: aiResponse.message,
        actions: executionResults.executedActions,
        cartId: executionResults.cartId,
        confidence: intent.confidence
      };

    } catch (error) {
      console.error('AI Orchestrator Error:', error);
      return {
        response: 'Lo siento, ocurrió un error. ¿Podrías reformular tu pregunta?',
        actions: [],
        confidence: 0
      };
    }
  }

  private async generateResponse(params: {
    message: string;
    intent: Intent;
    context: string;
    conversationHistory: Message[];
    shopId: string;
  }): Promise<{ message: string; actions: any[] }> {
    const systemPrompt = this.buildSystemPrompt(params.intent, params.shopId);
    
    const prompt = `
${systemPrompt}

Contexto de productos disponibles:
${params.context}

Historial de conversación:
${this.formatConversationHistory(params.conversationHistory)}

Usuario: ${params.message}

Responde en español de manera natural y útil. Si necesitas realizar acciones (como agregar al carrito), inclúyelas en formato JSON al final de tu respuesta.

Respuesta:`;

    const response = await this.callLLM(prompt);
    return this.parseAIResponse(response);
  }

  private buildSystemPrompt(intent: Intent, shopId: string): string {
    return `
Eres un asistente de ventas experto para una tienda en línea. Tu objetivo es:
1. Ayudar a los clientes a encontrar productos perfectos para sus necesidades
2. Proporcionar información detallada y precisa sobre productos
3. Asistir con el proceso de compra de manera natural y útil
4. Mantener un tono amigable y profesional

Capacidades disponibles:
- Buscar productos por nombre, descripción o características
- Comparar productos
- Agregar productos al carrito
- Modificar cantidades en el carrito
- Proporcionar recomendaciones personalizadas

IMPORTANTE:
- Siempre valida que los productos existan antes de recomendarlos
- Proporciona precios actualizados cuando estén disponibles
- Pregunta por detalles específicos si la solicitud es ambigua
- Usa el contexto de productos proporcionado para dar respuestas precisas

Intención detectada: ${intent.type} (confianza: ${intent.confidence})
`;
  }

  private formatProductContext(products: ProductSearchResult[]): string {
    return products.map(p => `
Producto: ${p.title}
Precio: $${p.price}
Descripción: ${p.description}
Disponibilidad: ${p.available ? 'En stock' : 'Agotado'}
ID: ${p.id}
`).join('\n---\n');
  }

  private async executeActions(actions: ValidatedAction[], context: {
    shopId: string;
    cartId?: string;
    sessionId: string;
  }): Promise<{ executedActions: Action[]; cartId?: string }> {
    const executedActions: Action[] = [];
    let currentCartId = context.cartId;

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'cart.create':
            currentCartId = await this.cartService.createCart(context.shopId);
            executedActions.push({
              type: 'cart.create',
              result: { cartId: currentCartId }
            });
            break;

          case 'cart.add':
            if (!currentCartId) {
              currentCartId = await this.cartService.createCart(context.shopId);
            }
            await this.cartService.addToCart(currentCartId, {
              variantId: action.variantId,
              quantity: action.quantity
            });
            executedActions.push({
              type: 'cart.add',
              result: { variantId: action.variantId, quantity: action.quantity }
            });
            break;

          case 'cart.update':
            if (currentCartId) {
              await this.cartService.updateCartLine(currentCartId, {
                lineId: action.lineId,
                quantity: action.quantity
              });
              executedActions.push({
                type: 'cart.update',
                result: { lineId: action.lineId, quantity: action.quantity }
              });
            }
            break;
        }
      } catch (error) {
        console.error(`Failed to execute action ${action.type}:`, error);
      }
    }

    return { executedActions, cartId: currentCartId };
  }
}
```

## 4. RAG Service Implementation

```typescript
// src/services/ai/rag.service.ts
export class RAGService {
  constructor(
    private supabase: SupabaseClient,
    private embeddingService: EmbeddingService
  ) {}

  async searchProducts(params: {
    query: string;
    shopId: string;
    limit: number;
    threshold: number;
  }): Promise<ProductSearchResult[]> {
    // Generate embedding for the query
    const queryEmbedding = await this.embeddingService.generateEmbedding(params.query);

    // Search for similar products using vector similarity
    const { data, error } = await this.supabase.rpc('search_products_semantic', {
      query_embedding: queryEmbedding,
      shop_id: params.shopId,
      similarity_threshold: params.threshold,
      match_limit: params.limit
    });

    if (error) {
      throw new AppError(`Vector search failed: ${error.message}`, ErrorType.DATABASE, 500);
    }

    return data.map(item => ({
      id: item.product_id,
      title: item.title,
      description: item.description_text,
      price: item.price,
      available: item.available,
      similarity: item.similarity,
      images: item.images,
      variants: item.variants
    }));
  }

  async generateProductEmbeddings(productId: string): Promise<void> {
    // Get product data
    const { data: product, error } = await this.supabase
      .from('products')
      .select(`
        *,
        variants:product_variants(*)
      `)
      .eq('id', productId)
      .single();

    if (error || !product) {
      throw new AppError(`Product not found: ${productId}`, ErrorType.NOT_FOUND, 404);
    }

    // Generate embeddings for different content types
    const embeddingTasks = [];

    // Product title + description embedding
    const productText = `${product.title}\n${product.description_text}\nCategoría: ${product.product_type}\nMarca: ${product.vendor}\nTags: ${product.tags.join(', ')}`;
    embeddingTasks.push(this.createEmbedding(productId, null, 'product', productText, {
      title: product.title,
      vendor: product.vendor,
      product_type: product.product_type,
      tags: product.tags
    }));

    // Variant-specific embeddings
    for (const variant of product.variants) {
      const variantText = `${product.title} - ${variant.title}\nPrecio: $${variant.price}\nSKU: ${variant.sku}\n${product.description_text}`;
      embeddingTasks.push(this.createEmbedding(productId, variant.id, 'variant', variantText, {
        title: variant.title,
        price: variant.price,
        sku: variant.sku,
        inventory_quantity: variant.inventory_quantity
      }));
    }

    await Promise.all(embeddingTasks);
  }

  private async createEmbedding(
    productId: string,
    variantId: string | null,
    contentType: string,
    text: string,
    metadata: any
  ): Promise<void> {
    const embedding = await this.embeddingService.generateEmbedding(text);

    const { error } = await this.supabase
      .from('product_embeddings')
      .upsert({
        product_id: productId,
        variant_id: variantId,
        content_type: contentType,
        content_text: text,
        embedding,
        metadata,
        model_version: 'text-embedding-3-small',
        created_at: new Date().toISOString()
      });

    if (error) {
      throw new AppError(`Failed to save embedding: ${error.message}`, ErrorType.DATABASE, 500);
    }
  }
}

// SQL function for vector similarity search
/*
CREATE OR REPLACE FUNCTION search_products_semantic(
  query_embedding vector(1536),
  shop_id uuid,
  similarity_threshold float DEFAULT 0.7,
  match_limit int DEFAULT 10
)
RETURNS TABLE (
  product_id uuid,
  title text,
  description_text text,
  price numeric,
  available boolean,
  similarity float,
  images jsonb,
  variants jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.title,
    p.description_text,
    pv.price::numeric,
    pv.available_for_sale,
    (1 - (pe.embedding <=> query_embedding)) as similarity,
    p.images,
    jsonb_agg(
      jsonb_build_object(
        'id', pv.id,
        'title', pv.title,
        'price', pv.price,
        'sku', pv.sku,
        'available', pv.available_for_sale
      )
    ) as variants
  FROM product_embeddings pe
  JOIN products p ON pe.product_id = p.id
  JOIN product_variants pv ON p.id = pv.product_id
  WHERE p.shop_id = search_products_semantic.shop_id
    AND pe.content_type = 'product'
    AND (1 - (pe.embedding <=> query_embedding)) > similarity_threshold
    AND p.status = 'active'
  GROUP BY p.id, p.title, p.description_text, pv.price, pv.available_for_sale, pe.embedding
  ORDER BY similarity DESC
  LIMIT match_limit;
END;
$$;
*/
```

## 5. Webhook Processing

```typescript
// src/services/shopify/webhook.service.ts
export class WebhookService {
  constructor(
    private productService: ProductService,
    private embeddingService: EmbeddingService,
    private queue: Queue
  ) {}

  async processProductWebhook(
    webhookType: 'products/create' | 'products/update' | 'products/delete',
    payload: any,
    shopId: string
  ): Promise<void> {
    switch (webhookType) {
      case 'products/create':
        await this.handleProductCreate(payload, shopId);
        break;
      case 'products/update':
        await this.handleProductUpdate(payload, shopId);
        break;
      case 'products/delete':
        await this.handleProductDelete(payload, shopId);
        break;
    }
  }

  private async handleProductCreate(payload: any, shopId: string): Promise<void> {
    try {
      // Transform Shopify product to our format
      const product = this.transformShopifyProduct(payload, shopId);
      
      // Save to database
      await this.productService.create(product);
      
      // Queue embedding generation
      await this.queue.add('generate-embeddings', {
        productId: product.id,
        shopId,
        priority: 'normal'
      });

      console.log(`Product created: ${product.title} (${product.id})`);
    } catch (error) {
      console.error('Failed to process product create webhook:', error);
      throw error;
    }
  }

  private async handleProductUpdate(payload: any, shopId: string): Promise<void> {
    try {
      const product = this.transformShopifyProduct(payload, shopId);
      const existingProduct = await this.productService.findByShopifyId(payload.id, shopId);
      
      if (!existingProduct) {
        // Product doesn't exist, treat as create
        await this.handleProductCreate(payload, shopId);
        return;
      }

      // Check if content changed (title, description, tags)
      const contentChanged = this.hasContentChanged(existingProduct, product);
      
      // Update product
      await this.productService.update(existingProduct.id, product);
      
      // Regenerate embeddings if content changed
      if (contentChanged) {
        await this.queue.add('regenerate-embeddings', {
          productId: existingProduct.id,
          shopId,
          priority: 'high'
        });
      }

      console.log(`Product updated: ${product.title} (${product.id})`);
    } catch (error) {
      console.error('Failed to process product update webhook:', error);
      throw error;
    }
  }

  private async handleProductDelete(payload: any, shopId: string): Promise<void> {
    try {
      const product = await this.productService.findByShopifyId(payload.id, shopId);
      
      if (product) {
        // Delete embeddings first
        await this.embeddingService.deleteProductEmbeddings(product.id);
        
        // Delete product and variants
        await this.productService.delete(product.id);
        
        console.log(`Product deleted: ${product.title} (${product.id})`);
      }
    } catch (error) {
      console.error('Failed to process product delete webhook:', error);
      throw error;
    }
  }

  private transformShopifyProduct(shopifyProduct: any, shopId: string): Partial<Product> {
    return {
      shop_id: shopId,
      shopify_id: shopifyProduct.id.toString(),
      title: shopifyProduct.title,
      description_html: shopifyProduct.body_html || '',
      description_text: this.stripHtml(shopifyProduct.body_html || ''),
      vendor: shopifyProduct.vendor,
      product_type: shopifyProduct.product_type,
      tags: shopifyProduct.tags ? shopifyProduct.tags.split(',').map(t => t.trim()) : [],
      handle: shopifyProduct.handle,
      status: shopifyProduct.status,
      images: shopifyProduct.images?.map(img => ({
        id: img.id.toString(),
        url: img.src,
        alt_text: img.alt,
        width: img.width,
        height: img.height
      })) || [],
      created_at: new Date(shopifyProduct.created_at),
      updated_at: new Date(shopifyProduct.updated_at)
    };
  }

  private hasContentChanged(existing: Product, updated: Partial<Product>): boolean {
    return (
      existing.title !== updated.title ||
      existing.description_text !== updated.description_text ||
      JSON.stringify(existing.tags) !== JSON.stringify(updated.tags)
    );
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}
```

Esta implementación te proporciona una base sólida para tu backend del agente IA, con patrones probados en producción y consideraciones de escalabilidad. Los archivos están en:

- `/Users/ignacioortiz/Documents/DevProjects/naay-agent/backend-architecture.md` - Arquitectura general
- `/Users/ignacioortiz/Documents/DevProjects/naay-agent/implementation-examples.md` - Ejemplos de implementación

¿Te gustaría que profundice en algún componente específico o que agregue ejemplos adicionales para testing, deployment o monitoring?