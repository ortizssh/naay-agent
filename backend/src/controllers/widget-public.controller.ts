import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { SupabaseService } from '@/services/supabase.service';
import { logger } from '@/utils/logger';

const router = Router();
const supabaseService = new SupabaseService();

// Serve widget script with complete CORS freedom
router.get('/kova-widget.js', (req: Request, res: Response) => {
  try {
    const widgetPath = path.join(__dirname, '..', 'public', 'kova-widget.js');

    if (!fs.existsSync(widgetPath)) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    // Set complete CORS and security headers for widget loading
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Access-Control-Allow-Credentials', 'false');

    // Remove problematic security headers
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('Cross-Origin-Resource-Policy');
    res.removeHeader('Cross-Origin-Opener-Policy');

    // Set permissive headers
    res.setHeader('Content-Security-Policy', '');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Anti-cache headers
    res.setHeader(
      'Cache-Control',
      'no-cache, no-store, must-revalidate, max-age=0'
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Last-Modified', new Date().toUTCString());
    res.setHeader('ETag', 'v2.1.0-' + Date.now());

    // Set content type
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');

    console.log(
      '🔥 Widget script served with CORS headers to:',
      req.get('Origin') || 'no-origin'
    );

    // Send file content
    const widgetContent = fs.readFileSync(widgetPath, 'utf8');
    res.send(widgetContent);
  } catch (error) {
    console.error('Error serving widget:', error);
    res.status(500).json({ error: 'Failed to serve widget' });
  }
});

// Handle OPTIONS for CORS preflight
router.options('/kova-widget.js', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Content-Length', '0');
  res.status(204).end();
});

/**
 * GET /api/widget/config
 * Public endpoint to get widget configuration for a shop
 * Called by the widget on initialization
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const shopDomain = req.query.shop as string;

    // Set CORS headers for widget access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (!shopDomain) {
      return res.status(400).json({
        success: false,
        error: 'shop parameter is required',
      });
    }

    // Try to get config from client_stores first
    const { data: clientStore } = await (supabaseService as any).serviceClient
      .from('client_stores')
      .select(
        `
        widget_position,
        widget_color,
        welcome_message,
        widget_enabled,
        widget_secondary_color,
        widget_accent_color,
        widget_button_size,
        widget_button_style,
        widget_show_pulse,
        widget_chat_width,
        widget_chat_height,
        widget_subtitle,
        widget_placeholder,
        widget_avatar,
        widget_show_promo_message,
        widget_show_cart,
        widget_enable_animations,
        widget_theme,
        widget_brand_name,
        widget_welcome_message_2,
        widget_subtitle_2,
        widget_welcome_message_3,
        widget_subtitle_3,
        widget_rotating_messages_enabled,
        widget_rotating_messages_interval,
        promo_badge_enabled,
        promo_badge_discount,
        promo_badge_text,
        promo_badge_color,
        promo_badge_shape,
        promo_badge_position
      `
      )
      .eq('shop_domain', shopDomain)
      .eq('widget_enabled', true)
      .single();

    if (clientStore) {
      logger.info('Widget config loaded from client_stores', { shopDomain });
      return res.json({
        success: true,
        data: {
          enabled: clientStore.widget_enabled ?? true,
          position: clientStore.widget_position || 'bottom-right',
          primaryColor: clientStore.widget_color || '#a59457',
          secondaryColor: clientStore.widget_secondary_color || '#212120',
          accentColor: clientStore.widget_accent_color || '#cf795e',
          greeting: clientStore.welcome_message || '',
          greeting2: clientStore.widget_welcome_message_2 || '',
          subtitle2: clientStore.widget_subtitle_2 || '',
          greeting3: clientStore.widget_welcome_message_3 || '',
          subtitle3: clientStore.widget_subtitle_3 || '',
          rotatingMessagesEnabled: clientStore.widget_rotating_messages_enabled ?? false,
          rotatingMessagesInterval: clientStore.widget_rotating_messages_interval || 5,
          subtitle:
            clientStore.widget_subtitle || 'Asistente de compras con IA',
          placeholder:
            clientStore.widget_placeholder || 'Escribe tu mensaje...',
          avatar: clientStore.widget_avatar || '🌿',
          brandName: clientStore.widget_brand_name || 'Kova',
          buttonSize: clientStore.widget_button_size || 72,
          buttonStyle: clientStore.widget_button_style || 'circle',
          showPulse: clientStore.widget_show_pulse ?? true,
          chatWidth: clientStore.widget_chat_width || 420,
          chatHeight: clientStore.widget_chat_height || 600,
          showPromoMessage: clientStore.widget_show_promo_message ?? true,
          showCart: clientStore.widget_show_cart ?? true,
          enableAnimations: clientStore.widget_enable_animations ?? true,
          theme: clientStore.widget_theme || 'light',
          // Promotion badge settings
          promoBadgeEnabled: clientStore.promo_badge_enabled ?? false,
          promoBadgeDiscount: clientStore.promo_badge_discount || 10,
          promoBadgeText: clientStore.promo_badge_text || 'Descuento especial',
          promoBadgeColor: clientStore.promo_badge_color || '#ef4444',
          promoBadgeShape: clientStore.promo_badge_shape || 'circle',
          promoBadgePosition: clientStore.promo_badge_position || 'right',
        },
      });
    }

    // Fallback: check stores table for legacy installations
    const { data: store } = await (supabaseService as any).serviceClient
      .from('stores')
      .select('widget_enabled')
      .eq('shop_domain', shopDomain)
      .single();

    if (store) {
      logger.info('Widget config loaded from stores (legacy)', { shopDomain });
      return res.json({
        success: true,
        data: {
          enabled: store.widget_enabled ?? true,
          // Return defaults for legacy stores
          position: 'bottom-right',
          primaryColor: '#a59457',
          secondaryColor: '#212120',
          accentColor: '#cf795e',
          greeting: '',
          subtitle: 'Asistente de compras con IA',
          placeholder: 'Escribe tu mensaje...',
          avatar: '🌿',
          brandName: 'Kova',
          buttonSize: 72,
          buttonStyle: 'circle',
          showPulse: true,
          chatWidth: 420,
          chatHeight: 600,
          showPromoMessage: true,
          showCart: true,
          enableAnimations: true,
          theme: 'light',
        },
      });
    }

    // No config found - return defaults (widget will use its built-in defaults)
    logger.warn('No widget config found for shop', { shopDomain });
    return res.json({
      success: true,
      data: null,
    });
  } catch (error) {
    logger.error('Error getting widget config:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get widget configuration',
    });
  }
});

// Handle OPTIONS for config endpoint
router.options('/config', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Content-Length', '0');
  res.status(204).end();
});

export default router;
