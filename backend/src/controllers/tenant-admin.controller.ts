import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { tenantService } from '@/services/tenant.service';
import { planService } from '@/services/plan.service';
import { SupabaseService } from '@/services/supabase.service';
import { knowledgeService } from '@/services/knowledge.service';
import { logger } from '@/utils/logger';
import { AppError, TenantPlan, TenantStatus } from '@/types';

const router = Router();
const supabaseService = new SupabaseService();

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// Multer config for knowledge file uploads: memory storage, 10MB limit, PDF/TXT/MD only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain', 'text/markdown'];
    if (
      allowed.includes(file.mimetype) ||
      file.originalname.match(/\.(txt|md|pdf)$/i)
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt, .md and .pdf files are allowed'));
    }
  },
});

/**
 * GET /api/admin/tenants/stats
 * Get dashboard statistics
 */
router.get(
  '/stats',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Fetching tenant dashboard stats');

      // Get all tenants for stats calculation
      const { tenants, total } = await tenantService.getAllTenants();

      // Get monthly message count and products count
      const now = new Date();
      const statsMonthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      ).toISOString();

      let totalMonthlyMessages = 0;
      let totalProducts = 0;

      try {
        const [msgResult, prodResult] = await Promise.all([
          (supabaseService as any).serviceClient
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'agent')
            .gte('timestamp', statsMonthStart),
          (supabaseService as any).serviceClient
            .from('products')
            .select('*', { count: 'exact', head: true }),
        ]);
        totalMonthlyMessages = msgResult.count || 0;
        totalProducts = prodResult.count || 0;
      } catch (err) {
        logger.warn('Failed to get stats counts:', err);
      }

      const stats = {
        totalTenants: total,
        activeTenants: tenants.filter(t => t.status === 'active').length,
        trialTenants: tenants.filter(t => t.status === 'trial').length,
        totalMessages: totalMonthlyMessages,
        totalProducts,
      };

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error fetching tenant stats:', error);
      next(error);
    }
  }
);

/**
 * POST /api/admin/tenants/fix-limits
 * Sync all tenants' features with their plan definitions
 */
router.post(
  '/fix-limits',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Syncing tenant features with plan definitions');

      const { tenants } = await tenantService.getAllTenants();
      const updates: Array<{
        shop_domain: string;
        plan: string;
        changes: string[];
      }> = [];

      for (const tenant of tenants) {
        const planLimits = await planService.getPlanLimits(tenant.plan);
        if (!planLimits) continue;

        const currentFeatures = tenant.features || {};
        const expectedFeatures = planLimits.features;
        const featuresDiffer = Object.keys(expectedFeatures).some(
          key =>
            currentFeatures[key as keyof typeof currentFeatures] !==
            expectedFeatures[key as keyof typeof expectedFeatures]
        );

        if (featuresDiffer) {
          await (supabaseService as any).serviceClient
            .from('tenants')
            .update({
              features: expectedFeatures,
              updated_at: new Date().toISOString(),
            })
            .eq('shop_domain', tenant.shop_domain);

          updates.push({
            shop_domain: tenant.shop_domain,
            plan: tenant.plan,
            changes: ['features updated'],
          });
        }
      }

      logger.info('Fix-limits completed', {
        updated: updates.length,
        total: tenants.length,
      });

      res.json({
        success: true,
        message: `Updated ${updates.length} of ${tenants.length} tenants`,
        data: { updated: updates },
      });
    } catch (error) {
      logger.error('Error fixing tenant limits:', error);
      next(error);
    }
  }
);

/**
 * GET /api/admin/tenants
 * List all tenants with pagination and filters
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '10', status, plan } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    logger.info('Fetching tenants list', {
      page: pageNum,
      limit: limitNum,
      status,
      plan,
    });

    const result = await tenantService.getAllTenants({
      status: status as TenantStatus | undefined,
      plan: plan as TenantPlan | undefined,
      limit: limitNum,
      offset: offset,
    });

    // Enrich tenants with client_stores data and monthly AI message counts
    const shopDomains = result.tenants.map(t => t.shop_domain);
    const now = new Date();
    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).toISOString();

    let storeMap = new Map<string, any>();
    let messageCounts: Record<string, number> = {};

    if (shopDomains.length > 0) {
      try {
        const [clientStoresResult, ...messageResults] = await Promise.all([
          (supabaseService as any).serviceClient
            .from('client_stores')
            .select(
              'shop_domain, platform, chatbot_endpoint, widget_enabled, is_active'
            )
            .in('shop_domain', shopDomains),
          ...shopDomains.map((domain: string) =>
            (supabaseService as any).serviceClient
              .from('chat_messages')
              .select('*', { count: 'exact', head: true })
              .eq('shop_domain', domain)
              .eq('role', 'agent')
              .gte('timestamp', monthStart)
          ),
        ]);

        (clientStoresResult.data || []).forEach((s: any) =>
          storeMap.set(s.shop_domain, s)
        );
        shopDomains.forEach((domain: string, i: number) => {
          messageCounts[domain] = messageResults[i]?.count || 0;
        });
      } catch (err) {
        logger.warn('Failed to enrich tenant list:', err);
      }
    }

    const enrichedTenants = result.tenants.map(t => ({
      ...t,
      platform: storeMap.get(t.shop_domain)?.platform || 'shopify',
      chatbot_endpoint: storeMap.get(t.shop_domain)?.chatbot_endpoint || null,
      widget_enabled: storeMap.get(t.shop_domain)?.widget_enabled ?? true,
      is_active: storeMap.get(t.shop_domain)?.is_active ?? false,
      real_message_count: messageCounts[t.shop_domain] || 0,
    }));

    res.json({
      success: true,
      data: {
        tenants: enrichedTenants,
        total: result.total,
      },
    });
  } catch (error) {
    logger.error('Error fetching tenants:', error);
    next(error);
  }
});

/**
 * GET /api/admin/tenants/:shopDomain/detail
 * Get enriched tenant detail from all related tables
 */
router.get(
  '/:shopDomain/detail',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shopDomain } = req.params;
      logger.info('Fetching enriched tenant detail', { shopDomain });

      const monthStart = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      ).toISOString();

      const [
        tenant,
        clientStoreResult,
        userResult,
        storeResult,
        msgCountResult,
        monthlyMsgResult,
        sessionResult,
        conversionResult,
        knowledgeCountResult,
      ] = await Promise.all([
        tenantService.getTenant(shopDomain),
        (supabaseService as any).serviceClient
          .from('client_stores')
          .select('*')
          .eq('shop_domain', shopDomain)
          .maybeSingle(),
        (supabaseService as any).serviceClient
          .from('admin_users')
          .select(
            'id, email, first_name, last_name, company, role, user_type, plan, status, last_login_at, created_at'
          )
          .eq('shop_domain', shopDomain)
          .maybeSingle(),
        (supabaseService as any).serviceClient
          .from('stores')
          .select('id, platform, site_url, widget_enabled, installed_at')
          .eq('shop_domain', shopDomain)
          .maybeSingle(),
        (supabaseService as any).serviceClient
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('shop_domain', shopDomain),
        (supabaseService as any).serviceClient
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('shop_domain', shopDomain)
          .eq('role', 'agent')
          .gte('timestamp', monthStart),
        (supabaseService as any).serviceClient
          .from('chat_messages')
          .select('session_id')
          .eq('shop_domain', shopDomain),
        (supabaseService as any).serviceClient
          .from('simple_conversions')
          .select('id, total_order_amount')
          .eq('shop_domain', shopDomain),
        (supabaseService as any).serviceClient
          .from('knowledge_documents')
          .select('*', { count: 'exact', head: true })
          .eq('shop_domain', shopDomain),
      ]);

      if (!tenant) {
        throw new AppError('Tenant not found', 404);
      }

      const uniqueSessions = new Set(
        (sessionResult.data || []).map((m: any) => m.session_id)
      ).size;

      const conversions = conversionResult.data || [];
      const totalRevenue = conversions.reduce(
        (sum: number, c: any) => sum + (parseFloat(c.total_order_amount) || 0),
        0
      );

      res.json({
        success: true,
        data: {
          tenant,
          clientStore: clientStoreResult.data || null,
          linkedUser: userResult.data || null,
          store: storeResult.data || null,
          stats: {
            totalMessages: msgCountResult.count || 0,
            monthlyMessages: monthlyMsgResult.count || 0,
            uniqueSessions,
            totalConversions: conversions.length,
            totalRevenue,
            knowledgeDocumentCount: knowledgeCountResult.count || 0,
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching tenant detail:', error);
      next(error);
    }
  }
);

/**
 * GET /api/admin/tenants/:shopDomain/knowledge
 * List knowledge documents for a tenant
 */
router.get(
  '/:shopDomain/knowledge',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shopDomain } = req.params;
      const documents = await knowledgeService.listDocuments(shopDomain);
      res.json({ success: true, data: documents });
    } catch (error) {
      logger.error('Admin list knowledge documents error:', error);
      next(error);
    }
  }
);

/**
 * POST /api/admin/tenants/:shopDomain/knowledge
 * Create a text knowledge document for a tenant
 */
router.post(
  '/:shopDomain/knowledge',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shopDomain } = req.params;
      const { title, content } = req.body;

      if (!title || !content) {
        throw new AppError('Title and content are required', 400);
      }

      const document = await knowledgeService.createDocument(shopDomain, {
        title,
        content,
        sourceType: 'text',
      });

      res.status(201).json({ success: true, data: document });
    } catch (error) {
      logger.error('Admin create knowledge document error:', error);
      next(error);
    }
  }
);

/**
 * POST /api/admin/tenants/:shopDomain/knowledge/upload
 * Upload a file (PDF/TXT/MD) as knowledge document for a tenant
 */
router.post(
  '/:shopDomain/knowledge/upload',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shopDomain } = req.params;
      const file = req.file;

      if (!file) {
        throw new AppError('File is required', 400);
      }

      const title = req.body.title || file.originalname;
      let content: string;

      if (
        file.mimetype === 'application/pdf' ||
        file.originalname.endsWith('.pdf')
      ) {
        const pdfData = await pdfParse(file.buffer);
        content = pdfData.text;
      } else {
        content = file.buffer.toString('utf-8');
      }

      if (!content.trim()) {
        throw new AppError('File contains no extractable text', 400);
      }

      const document = await knowledgeService.createDocument(shopDomain, {
        title,
        content,
        sourceType: 'file',
        originalFilename: file.originalname,
      });

      res.status(201).json({ success: true, data: document });
    } catch (error) {
      logger.error('Admin upload knowledge document error:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/admin/tenants/:shopDomain/knowledge/:docId
 * Delete a knowledge document for a tenant
 */
router.delete(
  '/:shopDomain/knowledge/:docId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shopDomain, docId } = req.params;
      await knowledgeService.deleteDocument(docId, shopDomain);
      res.json({ success: true });
    } catch (error) {
      logger.error('Admin delete knowledge document error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/admin/tenants/:shopDomain/knowledge/:docId/status
 * Get knowledge document processing status
 */
router.get(
  '/:shopDomain/knowledge/:docId/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shopDomain, docId } = req.params;
      const status = await knowledgeService.getDocumentStatus(
        docId,
        shopDomain
      );

      if (!status) {
        throw new AppError('Document not found', 404);
      }

      res.json({ success: true, data: status });
    } catch (error) {
      logger.error('Admin get knowledge document status error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/admin/tenants/:shopDomain
 * Get a specific tenant by shop domain
 */
router.get(
  '/:shopDomain',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shopDomain } = req.params;

      logger.info('Fetching tenant details', { shopDomain });

      const tenant = await tenantService.getTenant(shopDomain);

      if (!tenant) {
        throw new AppError('Tenant not found', 404);
      }

      res.json({
        success: true,
        data: tenant,
      });
    } catch (error) {
      logger.error('Error fetching tenant:', error);
      next(error);
    }
  }
);

/**
 * POST /api/admin/tenants
 * Create a new tenant (and store if needed)
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      shop_domain,
      access_token,
      shop_name,
      shop_email,
      plan,
      platform,
      chatbot_endpoint,
      widget_brand_name,
    } = req.body;

    if (!shop_domain) {
      throw new AppError('shop_domain is required', 400);
    }

    if (!access_token) {
      throw new AppError('access_token is required', 400);
    }

    logger.info('Creating new tenant', { shop_domain, plan });

    // Check if tenant already exists
    const existingTenant = await tenantService.getTenant(shop_domain);
    if (existingTenant) {
      throw new AppError('Tenant already exists for this shop', 409);
    }

    // Create or update store
    const storePlatform = platform || 'shopify';
    let store = await supabaseService.getStore(shop_domain);
    if (!store) {
      // Use serviceClient directly to support platform field
      const { data: newStore, error: storeError } = await (
        supabaseService as any
      ).serviceClient
        .from('stores')
        .insert({
          shop_domain,
          access_token,
          scopes:
            storePlatform === 'woocommerce'
              ? ''
              : 'read_products,write_products,read_orders,read_customers,write_draft_orders',
          platform: storePlatform,
          installed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          widget_enabled: true,
        })
        .select()
        .single();

      if (storeError) {
        logger.error('Error creating store:', storeError);
        throw new AppError('Failed to create store', 500);
      }
      store = newStore;
      logger.info('Store created for new tenant', {
        shop_domain,
        platform: storePlatform,
      });
    }

    // Create tenant
    const tenant = await tenantService.createTenant(shop_domain, {
      shopName: shop_name,
      shopEmail: shop_email,
      plan: plan as TenantPlan,
    });

    if (!tenant) {
      throw new AppError('Failed to create tenant', 500);
    }

    // Create default app settings
    try {
      const { error: settingsError } = await (
        supabaseService as any
      ).serviceClient
        .from('app_settings')
        .insert({
          shop_domain,
          chat_enabled: true,
          welcome_message:
            '¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte?',
          chat_position: 'bottom-right',
          chat_color: '#008060',
          auto_open_chat: false,
          show_agent_avatar: true,
          enable_product_recommendations: true,
          enable_order_tracking: true,
          enable_analytics: true,
          created_at: new Date(),
          updated_at: new Date(),
        });

      if (settingsError && settingsError.code !== '23505') {
        logger.warn('Failed to create app settings:', settingsError);
      }
    } catch (err) {
      logger.warn('Error creating app settings:', err);
    }

    // Create client_stores entry
    try {
      const { error: csError } = await (supabaseService as any).serviceClient
        .from('client_stores')
        .insert({
          shop_domain,
          platform: storePlatform,
          status: 'active',
          is_active: true,
          chatbot_endpoint: chatbot_endpoint || null,
          widget_enabled: true,
          widget_color: '#a59457',
          widget_brand_name: widget_brand_name || shop_name || shop_domain,
          welcome_message: 'Hola! Como puedo ayudarte?',
          widget_position: 'bottom-right',
        });

      if (csError && csError.code !== '23505') {
        logger.warn('Failed to create client_stores entry:', csError);
      }
    } catch (err) {
      logger.warn('Error creating client_stores entry:', err);
    }

    res.status(201).json({
      success: true,
      message: 'Tenant created successfully',
      data: tenant,
    });
  } catch (error) {
    logger.error('Error creating tenant:', error);
    next(error);
  }
});

/**
 * PUT /api/admin/tenants/:shopDomain
 * Update a tenant
 */
router.put(
  '/:shopDomain',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shopDomain } = req.params;
      const { plan, shop_name, shop_email } = req.body;

      logger.info('Updating tenant', { shopDomain, plan, shop_name });

      // Check if tenant exists
      const existingTenant = await tenantService.getTenant(shopDomain);
      if (!existingTenant) {
        throw new AppError('Tenant not found', 404);
      }

      let updatedTenant = existingTenant;

      // Update plan if changed
      if (plan && plan !== existingTenant.plan) {
        const result = await tenantService.updatePlan(
          shopDomain,
          plan as TenantPlan
        );
        if (result) {
          updatedTenant = result;
        }
      }

      // Update shop_name and shop_email if provided
      if (shop_name !== undefined || shop_email !== undefined) {
        const updateData: any = {};
        if (shop_name !== undefined) updateData.shop_name = shop_name;
        if (shop_email !== undefined) updateData.shop_email = shop_email;
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await (supabaseService as any).serviceClient
          .from('tenants')
          .update(updateData)
          .eq('shop_domain', shopDomain)
          .select()
          .single();

        if (error) {
          logger.error('Error updating tenant info:', error);
          throw new AppError('Failed to update tenant', 500);
        }

        // Refresh tenant data
        updatedTenant =
          (await tenantService.getTenant(shopDomain)) || updatedTenant;
      }

      // Update client_stores fields if any widget/integration fields are provided
      const clientStoreFields = [
        'chatbot_endpoint',
        'widget_enabled',
        'widget_color',
        'widget_secondary_color',
        'widget_accent_color',
        'widget_position',
        'widget_button_size',
        'widget_button_style',
        'widget_show_pulse',
        'widget_chat_width',
        'widget_chat_height',
        'widget_subtitle',
        'widget_placeholder',
        'widget_avatar',
        'widget_avatar_url',
        'widget_show_promo_message',
        'widget_show_cart',
        'widget_show_contact',
        'retell_agent_id',
        'retell_from_number',
        'widget_enable_animations',
        'widget_theme',
        'widget_brand_name',
        'welcome_message',
        'suggested_question_1_text',
        'suggested_question_1_message',
        'suggested_question_2_text',
        'suggested_question_2_message',
        'suggested_question_3_text',
        'suggested_question_3_message',
        'promo_badge_enabled',
        'promo_badge_discount',
        'promo_badge_text',
        'promo_badge_color',
        'promo_badge_shape',
        'promo_badge_position',
        'promo_badge_suffix',
        'promo_badge_font_size',
        'promo_badge_prefix',
        'promo_badge_type',
        'widget_rotating_messages_enabled',
        'widget_welcome_message_2',
        'widget_welcome_message_3',
        'widget_rotating_messages_interval',
        'widget_subtitle_2',
        'widget_subtitle_3',
        'chat_mode',
        'ai_model',
        'agent_name',
        'agent_tone',
        'brand_description',
        'agent_instructions',
        'agent_language',
      ];

      const clientStoreUpdate: Record<string, any> = {};
      for (const field of clientStoreFields) {
        if (req.body[field] !== undefined) {
          clientStoreUpdate[field] = req.body[field];
        }
      }

      if (Object.keys(clientStoreUpdate).length > 0) {
        clientStoreUpdate.updated_at = new Date().toISOString();
        const { error: csError } = await (supabaseService as any).serviceClient
          .from('client_stores')
          .update(clientStoreUpdate)
          .eq('shop_domain', shopDomain);

        if (csError) {
          logger.warn('Error updating client_store fields:', csError);
        }
      }

      // Update features on tenants if provided
      if (req.body.features !== undefined) {
        const { error: featError } = await (
          supabaseService as any
        ).serviceClient
          .from('tenants')
          .update({
            features: req.body.features,
            updated_at: new Date().toISOString(),
          })
          .eq('shop_domain', shopDomain);

        if (featError) {
          logger.warn('Error updating tenant features:', featError);
        }

        updatedTenant =
          (await tenantService.getTenant(shopDomain)) || updatedTenant;
      }

      res.json({
        success: true,
        message: 'Tenant updated successfully',
        data: updatedTenant,
      });
    } catch (error) {
      logger.error('Error updating tenant:', error);
      next(error);
    }
  }
);

/**
 * PUT /api/admin/tenants/:shopDomain/status
 * Update tenant status (activate, suspend, cancel)
 */
router.put(
  '/:shopDomain/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shopDomain } = req.params;
      const { status } = req.body;

      if (!status) {
        throw new AppError('status is required', 400);
      }

      const validStatuses: TenantStatus[] = [
        'active',
        'suspended',
        'cancelled',
        'trial',
      ];
      if (!validStatuses.includes(status)) {
        throw new AppError(
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          400
        );
      }

      logger.info('Updating tenant status', { shopDomain, status });

      // Check if tenant exists
      const existingTenant = await tenantService.getTenant(shopDomain);
      if (!existingTenant) {
        throw new AppError('Tenant not found', 404);
      }

      const success = await tenantService.updateStatus(
        shopDomain,
        status as TenantStatus
      );

      if (!success) {
        throw new AppError('Failed to update tenant status', 500);
      }

      // Get updated tenant
      const updatedTenant = await tenantService.getTenant(shopDomain);

      res.json({
        success: true,
        message: `Tenant status updated to ${status}`,
        data: updatedTenant,
      });
    } catch (error) {
      logger.error('Error updating tenant status:', error);
      next(error);
    }
  }
);

/**
 * POST /api/admin/tenants/:shopDomain/widget/avatar
 * Upload a custom avatar image for a tenant's widget
 */
router.post(
  '/:shopDomain/widget/avatar',
  avatarUpload.single('avatar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shopDomain } = req.params;

      if (!req.file) {
        throw new AppError('No image provided', 400);
      }

      const avatarUrl = await supabaseService.uploadChatFile(
        'chat-images',
        shopDomain,
        'widget-avatar',
        req.file.buffer,
        req.file.mimetype
      );

      await (supabaseService as any).serviceClient
        .from('client_stores')
        .update({ widget_avatar_url: avatarUrl })
        .eq('shop_domain', shopDomain);

      res.json({ success: true, data: { avatarUrl } });
    } catch (error) {
      logger.error('Upload tenant widget avatar error:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/admin/tenants/:shopDomain/widget/avatar
 * Remove a tenant's custom avatar image
 */
router.delete(
  '/:shopDomain/widget/avatar',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shopDomain } = req.params;

      await (supabaseService as any).serviceClient
        .from('client_stores')
        .update({ widget_avatar_url: null })
        .eq('shop_domain', shopDomain);

      res.json({ success: true });
    } catch (error) {
      logger.error('Delete tenant widget avatar error:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/admin/tenants/:shopDomain
 * Delete a tenant (soft delete - marks as cancelled)
 */
router.delete(
  '/:shopDomain',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shopDomain } = req.params;
      const { hard = 'false' } = req.query;

      logger.info('Deleting tenant', { shopDomain, hard });

      // Check if tenant exists
      const existingTenant = await tenantService.getTenant(shopDomain);
      if (!existingTenant) {
        throw new AppError('Tenant not found', 404);
      }

      if (hard === 'true') {
        // Hard delete - remove from database
        const { error } = await (supabaseService as any).serviceClient
          .from('tenants')
          .delete()
          .eq('shop_domain', shopDomain);

        if (error) {
          logger.error('Error hard deleting tenant:', error);
          throw new AppError('Failed to delete tenant', 500);
        }

        logger.info('Tenant hard deleted', { shopDomain });
      } else {
        // Soft delete - mark as cancelled
        const success = await tenantService.updateStatus(
          shopDomain,
          'cancelled'
        );
        if (!success) {
          throw new AppError('Failed to cancel tenant', 500);
        }

        logger.info('Tenant soft deleted (cancelled)', { shopDomain });
      }

      res.json({
        success: true,
        message:
          hard === 'true' ? 'Tenant deleted permanently' : 'Tenant cancelled',
      });
    } catch (error) {
      logger.error('Error deleting tenant:', error);
      next(error);
    }
  }
);

/**
 * GET /api/admin/tenants/:shopDomain/usage
 * Get usage details for a tenant
 */
router.get(
  '/:shopDomain/usage',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shopDomain } = req.params;

      logger.info('Fetching tenant usage', { shopDomain });

      const usage = await tenantService.getUsageInfo(shopDomain);

      if (!usage) {
        throw new AppError('Tenant not found', 404);
      }

      res.json({
        success: true,
        data: usage,
      });
    } catch (error) {
      logger.error('Error fetching tenant usage:', error);
      next(error);
    }
  }
);

/**
 * GET /api/admin/tenants/plans/info
 * Get available plans and their limits
 */
router.get(
  '/plans/info',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plans = await planService.getAllPlans();
      res.json({
        success: true,
        data: plans,
      });
    } catch (error) {
      logger.error('Error fetching plan info:', error);
      next(error);
    }
  }
);

export default router;
