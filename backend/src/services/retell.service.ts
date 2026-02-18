import Retell from 'retell-sdk';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';
import { cacheService } from '@/services/cache.service';
import crypto from 'crypto';

const VOICES_CACHE_KEY = 'retell:voices';
const VOICES_CACHE_TTL = 3600; // 1 hour

let retellInstance: Retell | null = null;

function getRetell(): Retell {
  if (!retellInstance) {
    if (!config.retell.apiKey) {
      throw new Error('RETELL_API_KEY is not configured');
    }
    retellInstance = new Retell({ apiKey: config.retell.apiKey });
  }
  return retellInstance;
}

export interface VoiceAgentConfig {
  prompt?: string;
  beginMessage?: string;
  model?: string;
  modelTemperature?: number;
  voiceId?: string;
  language?: string;
  voiceSpeed?: number;
  voiceTemperature?: number;
  responsiveness?: number;
  interruptionSensitivity?: number;
  enableBackchannel?: boolean;
  ambientSound?: string | null;
  maxCallDurationMs?: number;
  endCallAfterSilenceMs?: number;
  boostedKeywords?: string[];
  agentName?: string;
  webhookUrl?: string;
}

export interface ProvisionResult {
  llmId: string;
  agentId: string;
  phoneNumber: string;
}

export class RetellService {
  /**
   * List available voices (cached for 1hr)
   */
  async listVoices() {
    const cached = await cacheService.get<any[]>(VOICES_CACHE_KEY);
    if (cached) {
      return cached;
    }

    const retell = getRetell();
    const voices = await retell.voice.list();

    await cacheService.set(VOICES_CACHE_KEY, voices, { ttl: VOICES_CACHE_TTL });
    return voices;
  }

  /**
   * Create a Retell LLM
   */
  async createLlm(params: {
    prompt?: string;
    model?: string;
    beginMessage?: string;
    temperature?: number;
  }) {
    const retell = getRetell();

    const llm = await retell.llm.create({
      general_prompt: params.prompt || undefined,
      model: (params.model as any) || 'gpt-4.1-mini',
      begin_message: params.beginMessage || undefined,
      model_temperature: params.temperature ?? undefined,
    });

    logger.info('Created Retell LLM', { llmId: llm.llm_id });
    return llm;
  }

  /**
   * Update a Retell LLM
   */
  async updateLlm(llmId: string, params: {
    prompt?: string;
    model?: string;
    beginMessage?: string;
    temperature?: number;
  }) {
    const retell = getRetell();

    const llm = await retell.llm.update(llmId, {
      general_prompt: params.prompt ?? undefined,
      model: params.model ? (params.model as any) : undefined,
      begin_message: params.beginMessage ?? undefined,
      model_temperature: params.temperature ?? undefined,
    });

    logger.info('Updated Retell LLM', { llmId });
    return llm;
  }

  /**
   * Delete a Retell LLM
   */
  async deleteLlm(llmId: string) {
    const retell = getRetell();
    await retell.llm.delete(llmId);
    logger.info('Deleted Retell LLM', { llmId });
  }

  /**
   * Create a Retell Agent
   */
  async createAgent(params: {
    llmId: string;
    voiceId: string;
    name?: string;
    language?: string;
    voiceSpeed?: number;
    voiceTemperature?: number;
    responsiveness?: number;
    interruptionSensitivity?: number;
    enableBackchannel?: boolean;
    ambientSound?: string | null;
    maxCallDurationMs?: number;
    endCallAfterSilenceMs?: number;
    boostedKeywords?: string[];
    webhookUrl?: string;
  }) {
    const retell = getRetell();

    const agent = await retell.agent.create({
      response_engine: {
        type: 'retell-llm',
        llm_id: params.llmId,
      },
      voice_id: params.voiceId,
      agent_name: params.name || undefined,
      language: params.language as any || 'en-US',
      voice_speed: params.voiceSpeed ?? undefined,
      voice_temperature: params.voiceTemperature ?? undefined,
      responsiveness: params.responsiveness ?? undefined,
      interruption_sensitivity: params.interruptionSensitivity ?? undefined,
      enable_backchannel: params.enableBackchannel ?? undefined,
      ambient_sound: params.ambientSound as any ?? undefined,
      max_call_duration_ms: params.maxCallDurationMs ?? undefined,
      end_call_after_silence_ms: params.endCallAfterSilenceMs ?? undefined,
      boosted_keywords: params.boostedKeywords ?? undefined,
      webhook_url: params.webhookUrl || undefined,
    });

    logger.info('Created Retell Agent', { agentId: agent.agent_id });
    return agent;
  }

  /**
   * Update a Retell Agent
   */
  async updateAgent(agentId: string, params: {
    voiceId?: string;
    name?: string;
    language?: string;
    voiceSpeed?: number;
    voiceTemperature?: number;
    responsiveness?: number;
    interruptionSensitivity?: number;
    enableBackchannel?: boolean;
    ambientSound?: string | null;
    maxCallDurationMs?: number;
    endCallAfterSilenceMs?: number;
    boostedKeywords?: string[];
    webhookUrl?: string;
  }) {
    const retell = getRetell();

    const agent = await retell.agent.update(agentId, {
      voice_id: params.voiceId || undefined,
      agent_name: params.name ?? undefined,
      language: params.language ? (params.language as any) : undefined,
      voice_speed: params.voiceSpeed ?? undefined,
      voice_temperature: params.voiceTemperature ?? undefined,
      responsiveness: params.responsiveness ?? undefined,
      interruption_sensitivity: params.interruptionSensitivity ?? undefined,
      enable_backchannel: params.enableBackchannel ?? undefined,
      ambient_sound: params.ambientSound as any ?? undefined,
      max_call_duration_ms: params.maxCallDurationMs ?? undefined,
      end_call_after_silence_ms: params.endCallAfterSilenceMs ?? undefined,
      boosted_keywords: params.boostedKeywords ?? undefined,
      webhook_url: params.webhookUrl ?? undefined,
    });

    logger.info('Updated Retell Agent', { agentId });
    return agent;
  }

  /**
   * Delete a Retell Agent
   */
  async deleteAgent(agentId: string) {
    const retell = getRetell();
    await retell.agent.delete(agentId);
    logger.info('Deleted Retell Agent', { agentId });
  }

  /**
   * Buy a phone number
   */
  async buyPhoneNumber(areaCode?: number) {
    const retell = getRetell();

    const phone = await retell.phoneNumber.create({
      area_code: areaCode || undefined,
    });

    logger.info('Purchased phone number', { phoneNumber: phone.phone_number });
    return phone;
  }

  /**
   * Bind a phone number to an agent for inbound calls
   */
  async bindPhoneToAgent(phoneNumber: string, agentId: string) {
    const retell = getRetell();

    const updated = await retell.phoneNumber.update(phoneNumber, {
      inbound_agent_id: agentId,
    });

    logger.info('Bound phone to agent', { phoneNumber, agentId });
    return updated;
  }

  /**
   * Release a phone number
   */
  async releasePhoneNumber(phoneNumber: string) {
    const retell = getRetell();
    await retell.phoneNumber.delete(phoneNumber);
    logger.info('Released phone number', { phoneNumber });
  }

  /**
   * Create an outbound phone call using the SDK
   */
  async createPhoneCall(params: {
    fromNumber: string;
    toNumber: string;
    overrideAgentId?: string;
    dynamicVariables?: Record<string, string>;
    metadata?: Record<string, any>;
  }) {
    const retell = getRetell();

    const call = await retell.call.createPhoneCall({
      from_number: params.fromNumber.trim(),
      to_number: params.toNumber.trim(),
      override_agent_id: params.overrideAgentId || undefined,
      retell_llm_dynamic_variables: params.dynamicVariables || undefined,
      metadata: params.metadata || undefined,
    });

    logger.info('Created phone call', { callId: call.call_id });
    return call;
  }

  /**
   * Full provisioning: createLlm -> createAgent -> buyPhone -> bindPhone
   * Rolls back on failure.
   */
  async provisionVoiceAgent(
    shopDomain: string,
    agentConfig: VoiceAgentConfig
  ): Promise<ProvisionResult> {
    let llmId: string | null = null;
    let agentId: string | null = null;
    let phoneNumber: string | null = null;

    try {
      // Step 1: Create LLM
      const llm = await this.createLlm({
        prompt: agentConfig.prompt,
        model: agentConfig.model,
        beginMessage: agentConfig.beginMessage,
        temperature: agentConfig.modelTemperature,
      });
      llmId = llm.llm_id;

      // Step 2: Create Agent
      const agent = await this.createAgent({
        llmId,
        voiceId: agentConfig.voiceId || '11labs-Adrian',
        name: agentConfig.agentName || `Kova - ${shopDomain}`,
        language: agentConfig.language,
        voiceSpeed: agentConfig.voiceSpeed,
        voiceTemperature: agentConfig.voiceTemperature,
        responsiveness: agentConfig.responsiveness,
        interruptionSensitivity: agentConfig.interruptionSensitivity,
        enableBackchannel: agentConfig.enableBackchannel,
        ambientSound: agentConfig.ambientSound,
        maxCallDurationMs: agentConfig.maxCallDurationMs,
        endCallAfterSilenceMs: agentConfig.endCallAfterSilenceMs,
        boostedKeywords: agentConfig.boostedKeywords,
        webhookUrl: agentConfig.webhookUrl,
      });
      agentId = agent.agent_id;

      // Step 3: Buy phone number
      const phone = await this.buyPhoneNumber();
      phoneNumber = phone.phone_number;

      // Step 4: Bind phone to agent
      await this.bindPhoneToAgent(phoneNumber, agentId);

      logger.info('Voice agent provisioned', { shopDomain, llmId, agentId, phoneNumber });

      return { llmId, agentId, phoneNumber };
    } catch (error) {
      logger.error('Provisioning failed, rolling back', { shopDomain, llmId, agentId, phoneNumber, error });

      // Best-effort cleanup
      if (phoneNumber) {
        try { await this.releasePhoneNumber(phoneNumber); } catch (e) { logger.error('Rollback: failed to release phone', { phoneNumber, e }); }
      }
      if (agentId) {
        try { await this.deleteAgent(agentId); } catch (e) { logger.error('Rollback: failed to delete agent', { agentId, e }); }
      }
      if (llmId) {
        try { await this.deleteLlm(llmId); } catch (e) { logger.error('Rollback: failed to delete LLM', { llmId, e }); }
      }

      throw error;
    }
  }

  /**
   * Full deprovisioning: releasePhone -> deleteAgent -> deleteLlm
   * Best-effort: logs errors but doesn't throw on individual failures.
   */
  async deprovisionVoiceAgent(ids: {
    phoneNumber?: string;
    agentId?: string;
    llmId?: string;
  }) {
    const errors: string[] = [];

    if (ids.phoneNumber) {
      try { await this.releasePhoneNumber(ids.phoneNumber); } catch (e) {
        logger.error('Deprovision: failed to release phone', { phone: ids.phoneNumber, e });
        errors.push(`Failed to release phone: ${ids.phoneNumber}`);
      }
    }

    if (ids.agentId) {
      try { await this.deleteAgent(ids.agentId); } catch (e) {
        logger.error('Deprovision: failed to delete agent', { agentId: ids.agentId, e });
        errors.push(`Failed to delete agent: ${ids.agentId}`);
      }
    }

    if (ids.llmId) {
      try { await this.deleteLlm(ids.llmId); } catch (e) {
        logger.error('Deprovision: failed to delete LLM', { llmId: ids.llmId, e });
        errors.push(`Failed to delete LLM: ${ids.llmId}`);
      }
    }

    if (errors.length > 0) {
      logger.warn('Deprovision completed with errors', { errors });
    } else {
      logger.info('Voice agent deprovisioned successfully', ids);
    }
  }

  /**
   * Verify Retell webhook signature using HMAC
   */
  verifyWebhook(body: string, signature: string): boolean {
    if (!config.retell.apiKey || !signature) return false;

    const hash = crypto
      .createHmac('sha256', config.retell.apiKey)
      .update(body)
      .digest('hex');

    return hash === signature;
  }

  /**
   * List calls for an agent
   */
  async listCalls(agentId: string, options?: { limit?: number; paginationKey?: string }) {
    const retell = getRetell();

    const calls = await retell.call.list({
      filter_criteria: {
        agent_id: [agentId],
      },
      limit: options?.limit || 50,
      pagination_key: options?.paginationKey || undefined,
      sort_order: 'descending',
    });

    return calls;
  }
}

export const retellService = new RetellService();
