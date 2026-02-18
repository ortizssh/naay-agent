import { Router, Request, Response } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { retellService } from '@/services/retell.service';
import { logger } from '@/utils/logger';

const router = Router();
const supabaseService = new SupabaseService();

/**
 * POST /api/retell/webhooks
 * Handle Retell AI webhook events for call lifecycle
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const rawBody = (req as any).rawBody as string | undefined;
    const signature = req.headers['x-retell-signature'] as string;

    // Verify webhook signature
    if (rawBody && signature) {
      const valid = retellService.verifyWebhook(rawBody, signature);
      if (!valid) {
        logger.warn('Invalid Retell webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const event = req.body;
    const eventType = event?.event;
    const callData = event?.call;

    if (!eventType || !callData) {
      logger.warn('Retell webhook: missing event type or call data');
      return res.status(200).json({ received: true });
    }

    const agentId = callData.agent_id;

    // Lookup shop_domain by agent_id
    let shopDomain: string | null = null;
    if (agentId) {
      const { data } = await (supabaseService as any).serviceClient
        .from('client_stores')
        .select('shop_domain')
        .eq('retell_agent_id', agentId)
        .limit(1);

      shopDomain = data?.[0]?.shop_domain || null;
    }

    if (!shopDomain) {
      logger.warn('Retell webhook: could not resolve shop_domain for agent', {
        agentId,
      });
      return res.status(200).json({ received: true });
    }

    logger.info('Retell webhook received', {
      eventType,
      callId: callData.call_id,
      shopDomain,
    });

    switch (eventType) {
      case 'call_started': {
        await (supabaseService as any).serviceClient
          .from('voice_call_logs')
          .upsert(
            {
              retell_call_id: callData.call_id,
              shop_domain: shopDomain,
              agent_id: agentId,
              from_number: callData.from_number || null,
              to_number: callData.to_number || null,
              direction: callData.direction || 'inbound',
              status: 'started',
              started_at: callData.start_timestamp
                ? new Date(callData.start_timestamp).toISOString()
                : new Date().toISOString(),
              raw_event: event,
            },
            { onConflict: 'retell_call_id' }
          );
        break;
      }

      case 'call_ended': {
        const duration =
          callData.end_timestamp && callData.start_timestamp
            ? callData.end_timestamp - callData.start_timestamp
            : null;

        await (supabaseService as any).serviceClient
          .from('voice_call_logs')
          .upsert(
            {
              retell_call_id: callData.call_id,
              shop_domain: shopDomain,
              agent_id: agentId,
              from_number: callData.from_number || null,
              to_number: callData.to_number || null,
              direction: callData.direction || 'inbound',
              status: 'ended',
              started_at: callData.start_timestamp
                ? new Date(callData.start_timestamp).toISOString()
                : undefined,
              ended_at: callData.end_timestamp
                ? new Date(callData.end_timestamp).toISOString()
                : new Date().toISOString(),
              duration_ms: duration,
              disconnection_reason: callData.disconnection_reason || null,
              transcript: callData.transcript || null,
              raw_event: event,
            },
            { onConflict: 'retell_call_id' }
          );
        break;
      }

      case 'call_analyzed': {
        const updateData: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };

        if (callData.call_analysis) {
          updateData.call_summary = callData.call_analysis.call_summary || null;
          updateData.user_sentiment =
            callData.call_analysis.user_sentiment || null;
          updateData.call_successful =
            callData.call_analysis.call_successful ?? null;
        }

        await (supabaseService as any).serviceClient
          .from('voice_call_logs')
          .update(updateData)
          .eq('retell_call_id', callData.call_id);
        break;
      }

      default:
        logger.info('Retell webhook: unhandled event type', { eventType });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Retell webhook error:', error);
    // Always return 200 to prevent retries
    res.status(200).json({ received: true });
  }
});

export default router;
