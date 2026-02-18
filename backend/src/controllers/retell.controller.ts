import { Router, Request, Response, NextFunction } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { retellService } from '@/services/retell.service';
import { planService } from '@/services/plan.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';
import { config } from '@/utils/config';
import jwt from 'jsonwebtoken';

const router = Router();
const supabaseService = new SupabaseService();

const JWT_SECRET =
  process.env.JWT_SECRET || 'kova-admin-secret-key-change-in-production';

// Auth middleware (same pattern as client.controller.ts)
async function requireClientAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Token no proporcionado', 401);
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const { data: user, error } = await (supabaseService as any).serviceClient
      .from('admin_users')
      .select('*')
      .eq('id', decoded.id)
      .single();

    if (error || !user) throw new AppError('Usuario no encontrado', 404);
    if (user.status !== 'active') throw new AppError('Cuenta suspendida', 403);

    (req as any).user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Token invalido', 401));
    } else {
      next(error);
    }
  }
}

// Helper: get client_store for current user
async function getClientStore(req: Request) {
  const user = (req as any).user;
  const { data: stores } = await (supabaseService as any).serviceClient
    .from('client_stores')
    .select('*')
    .eq('user_id', user.id)
    .limit(1);

  if (!stores?.[0]) {
    throw new AppError('Tienda no encontrada', 404);
  }
  return stores[0];
}

/**
 * GET /api/retell/config
 * Get current voice agent configuration for the tenant
 */
router.get(
  '/config',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const store = await getClientStore(req);

      // Check plan
      const plan = store.plan || 'free';
      const limits = await planService.getPlanLimits(plan);
      const planAllowsVoiceAgent = limits.features?.voice_agents === true;

      res.json({
        success: true,
        data: {
          planAllowsVoiceAgent,
          plan,
          voiceAgentEnabled: store.voice_agent_enabled || false,
          retellAgentId: store.retell_agent_id || null,
          retellLlmId: store.retell_llm_id || null,
          retellPhoneNumber: store.retell_phone_number || null,
          retellFromNumber: store.retell_from_number || null,
          // Voice config
          voiceId: store.voice_agent_voice_id || null,
          language: store.voice_agent_language || 'en-US',
          voiceSpeed: store.voice_agent_voice_speed ?? 1.0,
          voiceTemperature: store.voice_agent_voice_temperature ?? 1.0,
          responsiveness: store.voice_agent_responsiveness ?? 0.7,
          interruptionSensitivity: store.voice_agent_interruption_sensitivity ?? 0.5,
          enableBackchannel: store.voice_agent_enable_backchannel ?? true,
          ambientSound: store.voice_agent_ambient_sound || null,
          maxCallDurationMs: store.voice_agent_max_call_duration_ms ?? 1800000,
          endCallAfterSilenceMs: store.voice_agent_end_call_after_silence_ms ?? 30000,
          boostedKeywords: store.voice_agent_boosted_keywords || [],
          // Prompt config
          prompt: store.voice_agent_prompt || '',
          beginMessage: store.voice_agent_begin_message || '',
          model: store.voice_agent_model || 'gpt-4.1-mini',
          modelTemperature: store.voice_agent_model_temperature ?? null,
        },
      });
    } catch (error) {
      logger.error('Error getting voice agent config:', error);
      next(error);
    }
  }
);

/**
 * PUT /api/retell/config
 * Update voice agent configuration. If agent exists, push changes to Retell.
 */
router.put(
  '/config',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const store = await getClientStore(req);

      if (!store.voice_agent_enabled) {
        throw new AppError('Voice agent is not enabled', 400);
      }

      const {
        voiceId, language, voiceSpeed, voiceTemperature,
        responsiveness, interruptionSensitivity, enableBackchannel,
        ambientSound, maxCallDurationMs, endCallAfterSilenceMs,
        boostedKeywords, prompt, beginMessage, model, modelTemperature,
      } = req.body;

      // Build DB update object
      const dbUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
      if (voiceId !== undefined) dbUpdate.voice_agent_voice_id = voiceId;
      if (language !== undefined) dbUpdate.voice_agent_language = language;
      if (voiceSpeed !== undefined) dbUpdate.voice_agent_voice_speed = voiceSpeed;
      if (voiceTemperature !== undefined) dbUpdate.voice_agent_voice_temperature = voiceTemperature;
      if (responsiveness !== undefined) dbUpdate.voice_agent_responsiveness = responsiveness;
      if (interruptionSensitivity !== undefined) dbUpdate.voice_agent_interruption_sensitivity = interruptionSensitivity;
      if (enableBackchannel !== undefined) dbUpdate.voice_agent_enable_backchannel = enableBackchannel;
      if (ambientSound !== undefined) dbUpdate.voice_agent_ambient_sound = ambientSound;
      if (maxCallDurationMs !== undefined) dbUpdate.voice_agent_max_call_duration_ms = maxCallDurationMs;
      if (endCallAfterSilenceMs !== undefined) dbUpdate.voice_agent_end_call_after_silence_ms = endCallAfterSilenceMs;
      if (boostedKeywords !== undefined) dbUpdate.voice_agent_boosted_keywords = boostedKeywords;
      if (prompt !== undefined) dbUpdate.voice_agent_prompt = prompt;
      if (beginMessage !== undefined) dbUpdate.voice_agent_begin_message = beginMessage;
      if (model !== undefined) dbUpdate.voice_agent_model = model;
      if (modelTemperature !== undefined) dbUpdate.voice_agent_model_temperature = modelTemperature;

      // Update DB
      await (supabaseService as any).serviceClient
        .from('client_stores')
        .update(dbUpdate)
        .eq('id', store.id);

      // If agent exists in Retell, push changes
      if (store.retell_agent_id) {
        try {
          // Update agent settings
          await retellService.updateAgent(store.retell_agent_id, {
            voiceId,
            language,
            voiceSpeed,
            voiceTemperature,
            responsiveness,
            interruptionSensitivity,
            enableBackchannel,
            ambientSound,
            maxCallDurationMs,
            endCallAfterSilenceMs,
            boostedKeywords,
          });
        } catch (e) {
          logger.error('Failed to update Retell agent, DB updated anyway', { agentId: store.retell_agent_id, e });
        }
      }

      if (store.retell_llm_id) {
        try {
          // Update LLM settings
          await retellService.updateLlm(store.retell_llm_id, {
            prompt,
            model,
            beginMessage,
            temperature: modelTemperature,
          });
        } catch (e) {
          logger.error('Failed to update Retell LLM, DB updated anyway', { llmId: store.retell_llm_id, e });
        }
      }

      res.json({ success: true, message: 'Voice agent configuration updated' });
    } catch (error) {
      logger.error('Error updating voice agent config:', error);
      next(error);
    }
  }
);

/**
 * POST /api/retell/enable
 * Provision: create LLM + Agent + buy phone number
 */
router.post(
  '/enable',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const store = await getClientStore(req);

      // Check plan
      const plan = store.plan || 'free';
      const limits = await planService.getPlanLimits(plan);
      if (!limits.features?.voice_agents) {
        throw new AppError('Tu plan no incluye Voice Agents. Actualiza a Professional o Enterprise.', 403);
      }

      // Check if already enabled
      if (store.voice_agent_enabled && store.retell_agent_id) {
        throw new AppError('Voice agent is already enabled', 400);
      }

      // Build webhook URL
      const appUrl = config.shopify?.appUrl || '';
      const webhookUrl = appUrl ? `${appUrl}/api/retell/webhooks` : undefined;

      // Provision
      const result = await retellService.provisionVoiceAgent(store.shop_domain, {
        prompt: store.voice_agent_prompt || undefined,
        beginMessage: store.voice_agent_begin_message || undefined,
        model: store.voice_agent_model || 'gpt-4.1-mini',
        modelTemperature: store.voice_agent_model_temperature ?? undefined,
        voiceId: store.voice_agent_voice_id || undefined,
        language: store.voice_agent_language || 'en-US',
        voiceSpeed: store.voice_agent_voice_speed ?? undefined,
        voiceTemperature: store.voice_agent_voice_temperature ?? undefined,
        responsiveness: store.voice_agent_responsiveness ?? undefined,
        interruptionSensitivity: store.voice_agent_interruption_sensitivity ?? undefined,
        enableBackchannel: store.voice_agent_enable_backchannel ?? undefined,
        ambientSound: store.voice_agent_ambient_sound || undefined,
        maxCallDurationMs: store.voice_agent_max_call_duration_ms ?? undefined,
        endCallAfterSilenceMs: store.voice_agent_end_call_after_silence_ms ?? undefined,
        boostedKeywords: store.voice_agent_boosted_keywords || undefined,
        webhookUrl,
      });

      // Update DB
      await (supabaseService as any).serviceClient
        .from('client_stores')
        .update({
          voice_agent_enabled: true,
          retell_llm_id: result.llmId,
          retell_agent_id: result.agentId,
          retell_phone_number: result.phoneNumber,
          retell_from_number: result.phoneNumber,
          updated_at: new Date().toISOString(),
        })
        .eq('id', store.id);

      logger.info('Voice agent enabled', { shopDomain: store.shop_domain, ...result });

      res.json({
        success: true,
        data: {
          agentId: result.agentId,
          llmId: result.llmId,
          phoneNumber: result.phoneNumber,
        },
      });
    } catch (error) {
      logger.error('Error enabling voice agent:', error);
      next(error);
    }
  }
);

/**
 * POST /api/retell/disable
 * Deprovision: release phone + delete agent + delete LLM
 */
router.post(
  '/disable',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const store = await getClientStore(req);

      if (!store.voice_agent_enabled) {
        throw new AppError('Voice agent is not enabled', 400);
      }

      // Deprovision
      await retellService.deprovisionVoiceAgent({
        phoneNumber: store.retell_phone_number || store.retell_from_number || undefined,
        agentId: store.retell_agent_id || undefined,
        llmId: store.retell_llm_id || undefined,
      });

      // Clear DB
      await (supabaseService as any).serviceClient
        .from('client_stores')
        .update({
          voice_agent_enabled: false,
          retell_llm_id: null,
          retell_agent_id: null,
          retell_phone_number: null,
          retell_from_number: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', store.id);

      logger.info('Voice agent disabled', { shopDomain: store.shop_domain });

      res.json({ success: true, message: 'Voice agent disabled' });
    } catch (error) {
      logger.error('Error disabling voice agent:', error);
      next(error);
    }
  }
);

/**
 * GET /api/retell/voices
 * List available voices (cached)
 */
router.get(
  '/voices',
  requireClientAuth,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const voices = await retellService.listVoices();
      res.json({ success: true, data: voices });
    } catch (error) {
      logger.error('Error listing voices:', error);
      next(error);
    }
  }
);

/**
 * GET /api/retell/calls
 * Get call history for the tenant (from voice_call_logs)
 */
router.get(
  '/calls',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const store = await getClientStore(req);
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;

      const { data: calls, error, count } = await (supabaseService as any).serviceClient
        .from('voice_call_logs')
        .select('*', { count: 'exact' })
        .eq('shop_domain', store.shop_domain)
        .order('started_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new AppError('Error al obtener historial de llamadas', 500);
      }

      res.json({
        success: true,
        data: calls || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit),
        },
      });
    } catch (error) {
      logger.error('Error getting call history:', error);
      next(error);
    }
  }
);

export default router;
