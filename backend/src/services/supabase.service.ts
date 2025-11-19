import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';
import {
  ShopifyStore,
  ShopifyProduct,
  ProductEmbedding,
  ChatSession,
  ChatMessage,
} from '@/types';

export class SupabaseService {
  private client: SupabaseClient;
  private serviceClient: SupabaseClient;

  constructor() {
    this.client = createClient(config.supabase.url, config.supabase.anonKey);
    this.serviceClient = createClient(
      config.supabase.url,
      config.supabase.serviceKey
    );
  }

  async createStore(store: Omit<ShopifyStore, 'id'>): Promise<ShopifyStore> {
    const { data, error } = await this.serviceClient
      .from('stores')
      .insert(store)
      .select()
      .single();

    if (error) {
      logger.error('Error creating store:', error);
      throw new Error(`Failed to create store: ${error.message}`);
    }

    return data;
  }

  async getStore(shopDomain: string): Promise<ShopifyStore | null> {
    const { data, error } = await this.serviceClient
      .from('stores')
      .select('*')
      .eq('shop_domain', shopDomain)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Error fetching store:', error);
      throw new Error(`Failed to fetch store: ${error.message}`);
    }

    return data;
  }

  async updateStoreToken(
    shopDomain: string,
    accessToken: string
  ): Promise<void> {
    const { error } = await this.serviceClient
      .from('stores')
      .update({ access_token: accessToken, updated_at: new Date() })
      .eq('shop_domain', shopDomain);

    if (error) {
      logger.error('Error updating store token:', error);
      throw new Error(`Failed to update store token: ${error.message}`);
    }
  }

  async updateStoreWidget(
    shopDomain: string,
    enabled: boolean
  ): Promise<Store> {
    const { data, error } = await this.serviceClient
      .from('stores')
      .update({ 
        widget_enabled: enabled, 
        updated_at: new Date() 
      })
      .eq('shop_domain', shopDomain)
      .select()
      .single();

    if (error) {
      logger.error('Error updating store widget setting:', error);
      throw new Error(`Failed to update widget setting: ${error.message}`);
    }

    return data;
  }

  async saveProduct(
    shopDomain: string,
    product: ShopifyProduct
  ): Promise<void> {
    const { error } = await this.serviceClient.from('products').upsert({
      id: product.id,
      shop_domain: shopDomain,
      title: product.title,
      description: product.description,
      handle: product.handle,
      vendor: product.vendor,
      product_type: product.product_type,
      tags: product.tags,
      images: product.images,
      created_at: product.created_at,
      updated_at: product.updated_at,
    });

    if (error) {
      logger.error('Error saving product:', error);
      throw new Error(`Failed to save product: ${error.message}`);
    }

    // Save variants
    for (const variant of product.variants) {
      await this.saveVariant(shopDomain, variant);
    }
  }

  async saveVariant(shopDomain: string, variant: any): Promise<void> {
    const { error } = await this.serviceClient.from('product_variants').upsert({
      id: variant.id,
      shop_domain: shopDomain,
      product_id: variant.product_id,
      title: variant.title,
      sku: variant.sku,
      price: variant.price,
      compare_at_price: variant.compare_at_price,
      inventory_quantity: variant.inventory_quantity,
      weight: variant.weight,
      weight_unit: variant.weight_unit,
      requires_shipping: variant.requires_shipping,
      taxable: variant.taxable,
    });

    if (error) {
      logger.error('Error saving variant:', error);
      throw new Error(`Failed to save variant: ${error.message}`);
    }
  }

  async saveEmbedding(
    embedding: Omit<ProductEmbedding, 'id' | 'created_at'>
  ): Promise<void> {
    const { error } = await this.serviceClient
      .from('product_embeddings')
      .upsert({
        ...embedding,
        embedding: `[${embedding.embedding.join(',')}]`,
      });

    if (error) {
      logger.error('Error saving embedding:', error);
      throw new Error(`Failed to save embedding: ${error.message}`);
    }
  }

  async searchProducts(
    shopDomain: string,
    query: string,
    embedding: number[],
    limit: number = 10
  ): Promise<any[]> {
    const { data, error } = await this.serviceClient.rpc(
      'search_products_semantic',
      {
        shop_domain: shopDomain,
        query_text: query,
        query_embedding: `[${embedding.join(',')}]`,
        match_threshold: 0.7,
        match_count: limit,
      }
    );

    if (error) {
      logger.error('Error searching products:', error);
      throw new Error(`Failed to search products: ${error.message}`);
    }

    return data || [];
  }

  async createChatSession(
    shopDomain: string,
    customerId?: string,
    cartId?: string
  ): Promise<ChatSession> {
    const { data, error } = await this.serviceClient
      .from('chat_sessions')
      .insert({
        shop_domain: shopDomain,
        customer_id: customerId,
        cart_id: cartId,
        started_at: new Date(),
        last_activity: new Date(),
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating chat session:', error);
      throw new Error(`Failed to create chat session: ${error.message}`);
    }

    return data;
  }

  async saveChatMessage(
    message: Omit<ChatMessage, 'id' | 'timestamp'>
  ): Promise<ChatMessage> {
    const { data, error } = await this.serviceClient
      .from('chat_messages')
      .insert({
        ...message,
        timestamp: new Date(),
      })
      .select()
      .single();

    if (error) {
      logger.error('Error saving chat message:', error);
      throw new Error(`Failed to save chat message: ${error.message}`);
    }

    return data;
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    const { error } = await this.serviceClient
      .from('chat_sessions')
      .update({ last_activity: new Date() })
      .eq('id', sessionId);

    if (error) {
      logger.error('Error updating session activity:', error);
    }
  }

  async getSessionHistory(
    sessionId: string,
    limit: number = 50
  ): Promise<ChatMessage[]> {
    const { data, error } = await this.serviceClient
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true })
      .limit(limit);

    if (error) {
      logger.error('Error fetching session history:', error);
      throw new Error(`Failed to fetch session history: ${error.message}`);
    }

    return data || [];
  }

  async deleteProduct(shopDomain: string, productId: string): Promise<void> {
    const { error } = await this.serviceClient
      .from('products')
      .delete()
      .eq('shop_domain', shopDomain)
      .eq('id', productId);

    if (error) {
      logger.error('Error deleting product:', error);
      throw new Error(`Failed to delete product: ${error.message}`);
    }
  }

  async deleteProductEmbeddings(
    shopDomain: string,
    productId: string
  ): Promise<void> {
    const { error } = await this.serviceClient
      .from('product_embeddings')
      .delete()
      .eq('shop_domain', shopDomain)
      .eq('product_id', productId);

    if (error) {
      logger.error('Error deleting product embeddings:', error);
      throw new Error(`Failed to delete product embeddings: ${error.message}`);
    }
  }

  // Modern Session Management Methods for Session Token Authentication

  /**
   * Store or update session information
   */
  async upsertSession(session: {
    shop: string;
    access_token: string;
    scope: string;
    expires_at: Date;
    session_id: string;
    is_online: boolean;
    user_id?: string;
  }): Promise<void> {
    const { error } = await this.serviceClient
      .from('shopify_sessions')
      .upsert({
        shop_domain: session.shop,
        access_token: session.access_token,
        scope: session.scope,
        expires_at: session.expires_at,
        session_id: session.session_id,
        is_online: session.is_online,
        user_id: session.user_id,
        updated_at: new Date(),
      });

    if (error) {
      logger.error('Error upserting session:', error);
      throw new Error(`Failed to upsert session: ${error.message}`);
    }

    // Also update or create the store record
    await this.serviceClient
      .from('stores')
      .upsert({
        shop_domain: session.shop,
        access_token: session.access_token,
        scopes: session.scope,
        installed_at: new Date(),
        updated_at: new Date(),
      });
  }

  /**
   * Get offline session for Admin API operations
   */
  async getOfflineSession(shopDomain: string): Promise<any | null> {
    const { data, error } = await this.serviceClient
      .from('shopify_sessions')
      .select('*')
      .eq('shop_domain', shopDomain)
      .eq('is_online', false)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Error fetching offline session:', error);
      throw new Error(`Failed to fetch offline session: ${error.message}`);
    }

    return data;
  }

  /**
   * Get online session for specific user
   */
  async getOnlineSession(shopDomain: string, userId: string): Promise<any | null> {
    const { data, error } = await this.serviceClient
      .from('shopify_sessions')
      .select('*')
      .eq('shop_domain', shopDomain)
      .eq('user_id', userId)
      .eq('is_online', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Error fetching online session:', error);
      throw new Error(`Failed to fetch online session: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete all sessions for a shop (used during uninstallation)
   */
  async deleteStoreSessions(shopDomain: string): Promise<void> {
    const { error } = await this.serviceClient
      .from('shopify_sessions')
      .delete()
      .eq('shop_domain', shopDomain);

    if (error) {
      logger.error('Error deleting store sessions:', error);
      throw new Error(`Failed to delete store sessions: ${error.message}`);
    }

    // Also remove from stores table
    await this.serviceClient
      .from('stores')
      .delete()
      .eq('shop_domain', shopDomain);
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    const { error } = await this.serviceClient
      .from('shopify_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (error) {
      logger.error('Error cleaning up expired sessions:', error);
      throw new Error(`Failed to cleanup expired sessions: ${error.message}`);
    }
  }

  /**
   * Get session by session ID
   */
  async getSessionById(sessionId: string): Promise<any | null> {
    const { data, error } = await this.serviceClient
      .from('shopify_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Error fetching session by ID:', error);
      throw new Error(`Failed to fetch session: ${error.message}`);
    }

    return data;
  }
}
