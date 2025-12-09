import { SupabaseService } from './supabase.service';
import { ShopifyService } from './shopify.service';
import { logger } from '@/utils/logger';

export interface ConversionMetrics {
  totalConversations: number;
  totalConversions: number;
  conversionRate: number;
  totalOrdersCount: number;
  averageOrderQuantity: number;
  averageTimeToConversion: number;
}

export interface ProductConversion {
  productId: string;
  productTitle: string;
  mentionsCount: number;
  conversionsCount: number;
  totalQuantitySold: number;
  conversionRate: number;
}

export interface ConversionAttribution {
  sessionId: string;
  orderId: string;
  customerMetadata?: any;
  chatStartedAt: Date;
  orderCreatedAt: Date;
  timeToConversionMinutes: number;
  productsMentioned: string[];
  productsPurchased: any[];
  matchingProducts: any[];
  attributionConfidence: number;
  totalOrderQuantity: number;
  matchingQuantity: number;
}

export class ChatConversionsService {
  private supabaseService: SupabaseService;
  private shopifyService: ShopifyService;

  constructor() {
    this.supabaseService = new SupabaseService();
    this.shopifyService = new ShopifyService();
  }

  /**
   * Analiza conversiones de chat a compras basado en:
   * 1. Productos mencionados en conversaciones
   * 2. Órdenes creadas dentro de una ventana de tiempo (48h)
   * 3. Coincidencias entre productos mencionados y comprados
   */
  async analyzeConversions(
    shopDomain: string,
    daysBack: number = 7
  ): Promise<ConversionMetrics> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      logger.info('Analyzing chat conversions', {
        shopDomain,
        daysBack,
        dateRange: `${startDate.toISOString()} - ${endDate.toISOString()}`,
      });

      // 1. Obtener conversaciones y productos mencionados
      const chatSessions = await this.getChatSessions(
        shopDomain,
        startDate,
        endDate
      );

      // 2. Obtener órdenes del período (con buffer de 48h)
      const orders = await this.getOrdersWithBuffer(
        shopDomain,
        startDate,
        endDate
      );

      // 3. Encontrar conversiones mediante atribución
      const conversions = await this.findConversions(chatSessions, orders);

      // 4. Calcular métricas
      const metrics = this.calculateMetrics(chatSessions, conversions);

      logger.info('Conversion analysis completed', {
        shopDomain,
        totalSessions: chatSessions.size,
        totalOrders: orders.length,
        totalConversions: conversions.length,
        conversionRate: metrics.conversionRate,
      });

      return metrics;
    } catch (error) {
      logger.error('Error analyzing conversions:', error);
      throw error;
    }
  }

  /**
   * Obtiene sesiones de chat con productos mencionados
   */
  private async getChatSessions(
    shopDomain: string,
    startDate: Date,
    endDate: Date
  ): Promise<Map<string, any>> {
    // First get count for pagination
    const { count: totalCount } = await (this.supabaseService as any).serviceClient
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .not('session_id', 'is', null)
      .eq('role', 'agent');

    // Fetch all messages in batches if there are many
    const allMessages = [];
    if (totalCount && totalCount > 1000) {
      const batchSize = 1000;
      const totalBatches = Math.ceil(totalCount / batchSize);

      for (let i = 0; i < totalBatches; i++) {
        const start = i * batchSize;
        const end = start + batchSize - 1;

        const { data: batch, error: batchError } = await (this.supabaseService as any).serviceClient
          .from('chat_messages')
          .select('session_id, timestamp, content, metadata, role')
          .gte('timestamp', startDate.toISOString())
          .lte('timestamp', endDate.toISOString())
          .not('session_id', 'is', null)
          .eq('role', 'agent')
          .range(start, end)
          .order('timestamp', { ascending: false });

        if (batchError) throw batchError;
        if (batch) allMessages.push(...batch);
      }
    } else {
      // For smaller datasets, use normal query
      const { data: messages, error } = await (this.supabaseService as any).serviceClient
        .from('chat_messages')
        .select('session_id, timestamp, content, metadata, role')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .not('session_id', 'is', null)
        .eq('role', 'agent');

      if (error) throw error;
      if (messages) allMessages.push(...messages);
    }

    const messages = allMessages;

    const sessions = new Map();

    if (messages) {
      for (const message of messages) {
        const sessionId = message.session_id;

        if (!sessions.has(sessionId)) {
          sessions.set(sessionId, {
            sessionId,
            startTime: new Date(message.timestamp),
            lastActivity: new Date(message.timestamp),
            productsMentioned: new Set(),
            mentionDetails: [],
          });
        }

        const session = sessions.get(sessionId);
        const messageTime = new Date(message.timestamp);

        if (messageTime < session.startTime) {
          session.startTime = messageTime;
        }
        if (messageTime > session.lastActivity) {
          session.lastActivity = messageTime;
        }

        // Extraer productos mencionados
        const products = this.extractProductsFromMessage(
          message.content,
          message.metadata
        );

        for (const productId of products) {
          session.productsMentioned.add(productId);
          session.mentionDetails.push({
            productId,
            timestamp: messageTime,
            content: message.content,
          });
        }
      }
    }

    return sessions;
  }

  /**
   * Obtiene órdenes con buffer de 48 horas
   */
  private async getOrdersWithBuffer(
    shopDomain: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    try {
      const store = await this.supabaseService.getStore(shopDomain);
      if (!store) {
        logger.warn('Store not found for conversions analysis:', shopDomain);
        return [];
      }

      // Extender el rango para capturar órdenes hasta 48h después del chat
      const extendedEndDate = new Date(endDate);
      extendedEndDate.setHours(extendedEndDate.getHours() + 48);

      const orders = await this.shopifyService.getOrdersByDateRange(
        store.shop_domain,
        store.access_token,
        startDate.toISOString(),
        extendedEndDate.toISOString()
      );

      logger.info('Orders retrieved for conversion analysis', {
        shopDomain,
        ordersCount: orders.length,
        dateRange: `${startDate.toISOString()} - ${extendedEndDate.toISOString()}`,
      });

      return orders;
    } catch (error) {
      logger.error('Error retrieving orders for conversion analysis:', error);
      return [];
    }
  }

  /**
   * Encuentra conversiones basado en atribución de productos
   */
  private async findConversions(
    chatSessions: Map<string, any>,
    orders: any[]
  ): Promise<ConversionAttribution[]> {
    const conversions: ConversionAttribution[] = [];

    for (const order of orders) {
      const orderTime = new Date(order.created_at);
      const orderProducts = this.extractOrderProducts(order);

      for (const [sessionId, session] of chatSessions) {
        // Verificar ventana de tiempo (chat debe ser antes de la orden)
        const timeDiff = orderTime.getTime() - session.lastActivity.getTime();
        const hoursAfterChat = timeDiff / (1000 * 60 * 60);

        // La orden debe ser dentro de 48 horas después del último mensaje
        if (hoursAfterChat >= 0 && hoursAfterChat <= 48) {
          // Buscar productos coincidentes
          const matchingProducts = this.findMatchingProducts(
            Array.from(session.productsMentioned),
            orderProducts
          );

          if (matchingProducts.length > 0) {
            // Calcular confianza de atribución
            const confidence = this.calculateAttributionConfidence(
              session.productsMentioned.size,
              orderProducts.length,
              matchingProducts.length,
              hoursAfterChat
            );

            // Solo considerar conversiones con confianza mínima
            if (confidence >= 0.3) {
              const totalQuantity = orderProducts.reduce(
                (sum: number, product: any) => sum + (product.quantity || 1),
                0
              );
              const matchingQuantity = matchingProducts.reduce(
                (sum: number, product: any) => sum + (product.quantity || 1),
                0
              );

              conversions.push({
                sessionId,
                orderId: order.id || order.order_number,
                customerMetadata: {
                  customerId: order.customer?.id,
                  email: order.customer?.email,
                },
                chatStartedAt: session.startTime,
                orderCreatedAt: orderTime,
                timeToConversionMinutes: Math.round(timeDiff / (1000 * 60)),
                productsMentioned: Array.from(session.productsMentioned),
                productsPurchased: orderProducts,
                matchingProducts,
                attributionConfidence: confidence,
                totalOrderQuantity: totalQuantity,
                matchingQuantity,
              });
            }
          }
        }
      }
    }

    return conversions;
  }

  /**
   * Calcula métricas finales de conversión
   */
  private calculateMetrics(
    chatSessions: Map<string, any>,
    conversions: ConversionAttribution[]
  ): ConversionMetrics {
    const totalConversations = chatSessions.size;
    const totalConversions = conversions.length;
    const conversionRate =
      totalConversations > 0
        ? (totalConversions / totalConversations) * 100
        : 0;

    const totalOrdersCount = conversions.reduce(
      (sum, conv) => sum + conv.totalOrderQuantity,
      0
    );

    const averageOrderQuantity =
      conversions.length > 0 ? totalOrdersCount / conversions.length : 0;

    const averageTimeToConversion =
      conversions.length > 0
        ? conversions.reduce(
            (sum, conv) => sum + conv.timeToConversionMinutes,
            0
          ) / conversions.length
        : 0;

    return {
      totalConversations,
      totalConversions,
      conversionRate: Math.round(conversionRate * 100) / 100,
      totalOrdersCount,
      averageOrderQuantity: Math.round(averageOrderQuantity * 100) / 100,
      averageTimeToConversion: Math.round(averageTimeToConversion * 100) / 100,
    };
  }

  /**
   * Extrae productos de una orden
   */
  private extractOrderProducts(order: any): any[] {
    if (!order.line_items) return [];

    return order.line_items.map((item: any) => ({
      productId: (item.variant?.product_id || item.product_id)?.toString(),
      variantId: item.variant_id?.toString(),
      title: item.title,
      quantity: parseInt(item.quantity || '1'),
      price: parseFloat(item.price || '0'),
    }));
  }

  /**
   * Encuentra productos coincidentes entre mencionados y comprados
   */
  private findMatchingProducts(
    mentionedProducts: string[],
    orderProducts: any[]
  ): any[] {
    return orderProducts.filter(orderProduct =>
      mentionedProducts.includes(orderProduct.productId)
    );
  }

  /**
   * Calcula confianza de atribución basada en múltiples factores
   */
  private calculateAttributionConfidence(
    mentionedCount: number,
    purchasedCount: number,
    matchingCount: number,
    hoursAfterChat: number
  ): number {
    let confidence = 0;

    // Factor de coincidencia de productos (40% del peso)
    const matchRatio = matchingCount / Math.max(mentionedCount, purchasedCount);
    confidence += matchRatio * 0.4;

    // Factor de tiempo (30% del peso) - más confianza si es más reciente
    const timeDecay = Math.max(0, (48 - hoursAfterChat) / 48);
    confidence += timeDecay * 0.3;

    // Factor de especificidad (30% del peso) - más confianza si hay menos productos
    const specificityScore = Math.max(0, (10 - purchasedCount) / 10);
    confidence += specificityScore * 0.3;

    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Extrae productos de un mensaje de chat (reutiliza lógica existente)
   */
  private extractProductsFromMessage(content: string, metadata: any): string[] {
    const productIds = new Set<string>();

    try {
      // Extraer de metadata
      if (metadata?.recommended_products) {
        metadata.recommended_products.forEach((product: any) => {
          if (product.id) productIds.add(product.id.toString());
        });
      }

      // Extraer de contenido JSON
      if (content) {
        const jsonRegex = /\{\s*"output"\s*:\s*\[[^\]]*\]\s*\}/g;
        const matches = content.match(jsonRegex);

        if (matches) {
          matches.forEach(match => {
            try {
              const jsonData = JSON.parse(match);
              if (jsonData.output && Array.isArray(jsonData.output)) {
                jsonData.output.forEach((item: any) => {
                  if (item.product?.id) {
                    productIds.add(item.product.id.toString());
                  }
                });
              }
            } catch (e) {
              // Ignore parsing errors
            }
          });
        }

        // Extraer IDs directos
        const productIdRegex = /product[_-]?id["\s]*:?\s*["']?(\d+)["']?/gi;
        const idMatches = content.matchAll(productIdRegex);
        for (const match of idMatches) {
          if (match[1]) productIds.add(match[1]);
        }
      }
    } catch (error) {
      // Ignore extraction errors
    }

    return Array.from(productIds);
  }

  /**
   * Obtiene análisis de conversión por producto
   */
  async getProductConversionAnalysis(
    shopDomain: string,
    daysBack: number = 30
  ): Promise<ProductConversion[]> {
    try {
      const conversions = await this.analyzeConversions(shopDomain, daysBack);
      // Implementar análisis por producto específico
      // Por ahora retorna array vacío, se implementaría basado en las conversiones encontradas
      return [];
    } catch (error) {
      logger.error('Error analyzing product conversions:', error);
      return [];
    }
  }
}
