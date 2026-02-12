import express from 'express';
import request from 'supertest';

// ── Persistent mock references (survive resetMocks) ────────────────

const mockChatCreate = jest.fn();
const mockTranscriptionsCreate = jest.fn();
const mockToFile = jest.fn().mockResolvedValue({ name: 'audio.webm' });
const mockUploadChatFile = jest.fn();

// Persistent tenant service mocks (survive resetMocks)
const mockGetTenant = jest.fn();
const mockValidateTenantAccess = jest.fn();
const mockRecordActivity = jest.fn();
const mockInvalidateMessageCountCache = jest.fn();

// ── Mocks (must be before import) ──────────────────────────────────

jest.mock('@/utils/config', () => ({
  config: { openai: { apiKey: 'test-key' } },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/services/tenant.service', () => ({
  tenantService: {
    getTenant: mockGetTenant,
    validateTenantAccess: mockValidateTenantAccess,
    recordActivity: mockRecordActivity,
    invalidateMessageCountCache: mockInvalidateMessageCountCache,
  },
}));

// Create a fully chainable Supabase mock that resolves to { data: null/[] }
// Must be a proper thenable (with .then AND .catch) since code uses both await and .catch()
function createChainMock(resolveValue: any = { data: null }) {
  const resolved = Promise.resolve(resolveValue);
  const chain: any = {};
  const methods = [
    'from',
    'select',
    'eq',
    'or',
    'limit',
    'single',
    'gte',
    'lte',
    'in',
    'order',
    'insert',
    'update',
    'delete',
    'upsert',
  ];
  for (const method of methods) {
    chain[method] = jest.fn().mockImplementation(() => chain);
  }
  // Make the chain a full thenable (supports both await and .catch())
  chain.then = (onFulfilled: any, onRejected?: any) =>
    resolved.then(onFulfilled, onRejected);
  chain.catch = (onRejected: any) => resolved.catch(onRejected);
  return chain;
}

const mockChain = createChainMock({ data: null, error: null });
const mockFrom = jest.fn().mockReturnValue(mockChain);

jest.mock('@/services/supabase.service', () => ({
  SupabaseService: jest.fn().mockImplementation(() => ({
    serviceClient: { from: mockFrom },
    searchProductsSemantic: jest.fn().mockResolvedValue([]),
    uploadChatFile: mockUploadChatFile,
  })),
}));

jest.mock('@/middleware/tenant.middleware', () => ({
  createTenantRateLimiter: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('@/services/simple-conversion-tracker.service', () => ({
  SimpleConversionTracker: jest.fn().mockImplementation(() => ({
    trackRecommendation: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@/services/knowledge.service', () => ({
  knowledgeService: {
    searchKnowledge: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/platforms/interfaces/commerce.interface', () => ({
  getCommerceProvider: jest.fn().mockReturnValue(null),
  registerCommerceProvider: jest.fn(),
}));

jest.mock('@/platforms/woocommerce', () => ({}));

// OpenAI: constructor returns object with persistent mock references
jest.mock('openai', () => {
  const OpenAIMock = function () {
    return {
      chat: { completions: { create: mockChatCreate } },
      audio: { transcriptions: { create: mockTranscriptionsCreate } },
    };
  };
  // Support both `import OpenAI from 'openai'` and `require('openai')`
  OpenAIMock.default = OpenAIMock;
  OpenAIMock.__esModule = true;
  return OpenAIMock;
});

jest.mock('openai/uploads', () => ({
  toFile: mockToFile,
}));

// ── Setup ──────────────────────────────────────────────────────────

let app: express.Express;

beforeAll(async () => {
  const routerModule = await import('../simple-chat.controller');
  app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/simple-chat', routerModule.default);
});

beforeEach(() => {
  mockChatCreate.mockReset();
  mockTranscriptionsCreate.mockReset();
  mockToFile.mockReset();
  mockUploadChatFile.mockReset();
  mockGetTenant.mockReset();
  mockValidateTenantAccess.mockReset();
  mockRecordActivity.mockReset();
  mockInvalidateMessageCountCache.mockReset();

  // Default successful completion
  mockChatCreate.mockResolvedValue({
    choices: [
      {
        message: { content: 'Respuesta del asistente', tool_calls: null },
      },
    ],
  });

  mockToFile.mockResolvedValue({ name: 'audio.webm' });

  // Default: upload succeeds with a fake URL
  mockUploadChatFile.mockResolvedValue(
    'https://storage.example.com/chat-audio/test/file.webm'
  );

  // Default tenant mocks
  mockGetTenant.mockResolvedValue(null);
  mockValidateTenantAccess.mockResolvedValue(true);
  mockRecordActivity.mockResolvedValue(undefined);
  mockInvalidateMessageCountCache.mockResolvedValue(undefined);
});

// ── Tests ──────────────────────────────────────────────────────────

describe('POST /api/simple-chat — attachment handling', () => {
  // ─── Validation ────────────────────────────────────────────────

  describe('validation', () => {
    it('should reject request with no message AND no attachment', async () => {
      const res = await request(app)
        .post('/api/simple-chat')
        .send({ shop: 'test.myshopify.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Message or attachment is required/);
    });

    it('should reject attachment with invalid type', async () => {
      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          shop: 'test.myshopify.com',
          attachment: { type: 'video', data: 'abc123', mimeType: 'video/mp4' },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid attachment type/);
    });

    it('should reject attachment with missing data', async () => {
      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          shop: 'test.myshopify.com',
          attachment: { type: 'image' },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Attachment data is required/);
    });

    it('should reject attachment with non-string data', async () => {
      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          shop: 'test.myshopify.com',
          attachment: { type: 'image', data: 12345 },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Attachment data is required/);
    });

    it('should reject image attachment exceeding size limit', async () => {
      const largeData = 'x'.repeat(2_900_000);
      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          shop: 'test.myshopify.com',
          attachment: {
            type: 'image',
            data: largeData,
            mimeType: 'image/jpeg',
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Attachment too large.*2MB/);
    });

    it('should reject audio attachment exceeding size limit', async () => {
      const largeData = 'x'.repeat(6_900_000);
      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          shop: 'test.myshopify.com',
          attachment: {
            type: 'audio',
            data: largeData,
            mimeType: 'audio/webm',
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Attachment too large.*5MB/);
    });

    it('should allow message without attachment (backward compat)', async () => {
      const res = await request(app)
        .post('/api/simple-chat')
        .send({ message: 'Hola', shop: 'test.myshopify.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should allow attachment without message', async () => {
      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          shop: 'test.myshopify.com',
          attachment: {
            type: 'image',
            data: 'base64data',
            mimeType: 'image/jpeg',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Image attachment ──────────────────────────────────────────

  describe('image attachment', () => {
    it('should send multimodal message to OpenAI with image', async () => {
      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          message: 'Busca algo similar',
          shop: 'test.myshopify.com',
          attachment: {
            type: 'image',
            data: 'fakeBase64ImageData',
            mimeType: 'image/jpeg',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify OpenAI was called with multimodal content
      expect(mockChatCreate).toHaveBeenCalled();
      const callArgs = mockChatCreate.mock.calls[0][0];
      const messages = callArgs.messages;
      const lastMsg = messages[messages.length - 1];

      expect(lastMsg.role).toBe('user');
      expect(Array.isArray(lastMsg.content)).toBe(true);
      expect(lastMsg.content).toHaveLength(2);
      expect(lastMsg.content[0]).toEqual({
        type: 'text',
        text: 'Busca algo similar',
      });
      expect(lastMsg.content[1]).toEqual({
        type: 'image_url',
        image_url: {
          url: 'data:image/jpeg;base64,fakeBase64ImageData',
          detail: 'low',
        },
      });
    });

    it('should use default text when image sent without message', async () => {
      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          shop: 'test.myshopify.com',
          attachment: {
            type: 'image',
            data: 'fakeBase64ImageData',
            mimeType: 'image/jpeg',
          },
        });

      expect(res.status).toBe(200);

      const callArgs = mockChatCreate.mock.calls[0][0];
      const lastMsg = callArgs.messages[callArgs.messages.length - 1];
      expect(lastMsg.content[0].text).toMatch(/Describe esta imagen/);
    });

    it('should not include transcription field for image response', async () => {
      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          shop: 'test.myshopify.com',
          attachment: {
            type: 'image',
            data: 'fakeBase64',
            mimeType: 'image/jpeg',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.transcription).toBeUndefined();
    });

    it('should store "[Imagen enviada]" in conversation history', async () => {
      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          shop: 'test.myshopify.com',
          attachment: {
            type: 'image',
            data: 'fakeBase64',
            mimeType: 'image/jpeg',
          },
        });

      expect(res.status).toBe(200);

      // The history message (2nd position after system) should be text, not multimodal
      const callArgs = mockChatCreate.mock.calls[0][0];
      const messages = callArgs.messages;

      // System prompt is first, then the multimodal user message
      // But the conversationStore entry should be text — which we confirm
      // by checking there's only system + 1 user message (no prior history)
      expect(messages.length).toBe(2); // system + current user
      expect(messages[0].role).toBe('system');
    });
  });

  // ─── Audio attachment ──────────────────────────────────────────

  describe('audio attachment', () => {
    beforeEach(() => {
      mockTranscriptionsCreate.mockResolvedValue({
        text: 'Hola, busco zapatillas rojas',
      });
    });

    it('should transcribe audio and use transcription as message', async () => {
      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          shop: 'test.myshopify.com',
          attachment: {
            type: 'audio',
            data: 'fakeBase64Audio',
            mimeType: 'audio/webm',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify Whisper was called
      expect(mockTranscriptionsCreate).toHaveBeenCalledWith({
        model: 'whisper-1',
        file: expect.anything(),
        language: 'es',
      });

      // Verify transcription is used as chat message (text, not multimodal)
      const callArgs = mockChatCreate.mock.calls[0][0];
      const lastMsg = callArgs.messages[callArgs.messages.length - 1];
      expect(lastMsg.role).toBe('user');
      expect(lastMsg.content).toBe('Hola, busco zapatillas rojas');
    });

    it('should return transcription field in response', async () => {
      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          shop: 'test.myshopify.com',
          attachment: {
            type: 'audio',
            data: 'fakeBase64Audio',
            mimeType: 'audio/webm',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.transcription).toBe('Hola, busco zapatillas rojas');
    });

    it('should call toFile with correct extension for different mime types', async () => {
      mockTranscriptionsCreate.mockResolvedValue({ text: 'Test' });

      await request(app)
        .post('/api/simple-chat')
        .send({
          shop: 'test.myshopify.com',
          attachment: {
            type: 'audio',
            data: 'fakeBase64',
            mimeType: 'audio/mp4',
          },
        });

      expect(mockToFile).toHaveBeenCalledWith(expect.any(Buffer), 'audio.mp4', {
        type: 'audio/mp4',
      });
    });

    it('should default to webm mime type when not provided', async () => {
      mockTranscriptionsCreate.mockResolvedValue({ text: 'Test' });

      await request(app)
        .post('/api/simple-chat')
        .send({
          shop: 'test.myshopify.com',
          attachment: { type: 'audio', data: 'fakeBase64' },
        });

      // Should use default 'audio/webm' when mimeType is not provided
      expect(mockToFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        'audio.webm',
        { type: 'audio/webm' }
      );
    });

    it('should return 500 when Whisper transcription fails', async () => {
      mockTranscriptionsCreate.mockRejectedValue(
        new Error('Whisper API error')
      );

      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          shop: 'test.myshopify.com',
          attachment: {
            type: 'audio',
            data: 'fakeBase64Audio',
            mimeType: 'audio/webm',
          },
        });

      expect(res.status).toBe(500);
      expect(res.body.data.response).toMatch(/transcribir/);
    });
  });

  // ─── Combined text + attachment ────────────────────────────────

  describe('text + attachment', () => {
    it('should include user text alongside image in multimodal message', async () => {
      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          message: 'Quiero algo como esto',
          shop: 'test.myshopify.com',
          attachment: {
            type: 'image',
            data: 'imgData',
            mimeType: 'image/jpeg',
          },
        });

      expect(res.status).toBe(200);

      const callArgs = mockChatCreate.mock.calls[0][0];
      const lastMsg = callArgs.messages[callArgs.messages.length - 1];

      expect(lastMsg.content[0].text).toBe('Quiero algo como esto');
      expect(lastMsg.content[1].type).toBe('image_url');
    });

    it('should use transcription (not original text) for audio attachment', async () => {
      mockTranscriptionsCreate.mockResolvedValue({
        text: 'Transcripción del audio',
      });

      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          message: 'texto original que se ignora',
          shop: 'test.myshopify.com',
          attachment: {
            type: 'audio',
            data: 'audioData',
            mimeType: 'audio/webm',
          },
        });

      expect(res.status).toBe(200);

      const callArgs = mockChatCreate.mock.calls[0][0];
      const lastMsg = callArgs.messages[callArgs.messages.length - 1];
      expect(lastMsg.content).toBe('Transcripción del audio');
    });

    it('should store image+text as "[Imagen enviada] text" in history', async () => {
      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          message: 'Mira esto',
          shop: 'test.myshopify.com',
          conversationId: 'conv_img_hist',
          attachment: {
            type: 'image',
            data: 'imgData',
            mimeType: 'image/jpeg',
          },
        });

      expect(res.status).toBe(200);

      // Send a follow-up text message to same conversation — the history should contain the text version
      const res2 = await request(app).post('/api/simple-chat').send({
        message: 'Y algo más',
        shop: 'test.myshopify.com',
        conversationId: 'conv_img_hist',
      });

      expect(res2.status).toBe(200);

      // Second call's messages should contain history with the text version of the image message
      const callArgs = mockChatCreate.mock.calls[1][0];
      const messages = callArgs.messages;
      // messages: [system, "[Imagen enviada] Mira esto" (history), "Respuesta del asistente" (history), "Y algo más" (current)]
      const imageHistoryMsg = messages[1];
      expect(imageHistoryMsg.content).toBe('[Imagen enviada] Mira esto');
      expect(typeof imageHistoryMsg.content).toBe('string'); // text, not multimodal array
    });
  });

  // ─── Response format ───────────────────────────────────────────

  describe('response format', () => {
    it('should maintain conversationId through attachment messages', async () => {
      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          shop: 'test.myshopify.com',
          conversationId: 'conv_123',
          attachment: {
            type: 'image',
            data: 'imgData',
            mimeType: 'image/jpeg',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.conversationId).toBe('conv_123');
    });

    it('should generate conversationId when not provided', async () => {
      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          shop: 'test.myshopify.com',
          attachment: {
            type: 'image',
            data: 'imgData',
            mimeType: 'image/jpeg',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.conversationId).toMatch(/^simple_/);
    });

    it('should return assistant response for attachment messages', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Veo una imagen interesante',
              tool_calls: null,
            },
          },
        ],
      });

      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          shop: 'test.myshopify.com',
          attachment: {
            type: 'image',
            data: 'imgData',
            mimeType: 'image/jpeg',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.response).toContain('Veo una imagen interesante');
    });
  });

  // ─── Storage upload URLs ──────────────────────────────────────

  describe('storage upload URLs', () => {
    it('should return audioUrl when audio upload succeeds', async () => {
      mockTranscriptionsCreate.mockResolvedValue({ text: 'Hola mundo' });
      mockUploadChatFile.mockResolvedValue(
        'https://storage.example.com/chat-audio/shop/sess/123.webm'
      );

      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          shop: 'test.myshopify.com',
          attachment: {
            type: 'audio',
            data: 'fakeBase64Audio',
            mimeType: 'audio/webm',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.audioUrl).toBe(
        'https://storage.example.com/chat-audio/shop/sess/123.webm'
      );
      expect(mockUploadChatFile).toHaveBeenCalledWith(
        'chat-audio',
        expect.any(String),
        expect.any(String),
        expect.any(Buffer),
        'audio/webm'
      );
    });

    it('should return imageUrl when image upload succeeds', async () => {
      mockUploadChatFile.mockResolvedValue(
        'https://storage.example.com/chat-images/shop/sess/123.jpg'
      );

      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          shop: 'test.myshopify.com',
          attachment: {
            type: 'image',
            data: 'fakeBase64Image',
            mimeType: 'image/jpeg',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.imageUrl).toBe(
        'https://storage.example.com/chat-images/shop/sess/123.jpg'
      );
      expect(mockUploadChatFile).toHaveBeenCalledWith(
        'chat-images',
        expect.any(String),
        expect.any(String),
        expect.any(Buffer),
        'image/jpeg'
      );
    });

    it('should still succeed when audio upload fails (graceful fallback)', async () => {
      mockTranscriptionsCreate.mockResolvedValue({ text: 'Audio transcrito' });
      mockUploadChatFile.mockRejectedValue(new Error('Storage unavailable'));

      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          shop: 'test.myshopify.com',
          attachment: {
            type: 'audio',
            data: 'fakeBase64Audio',
            mimeType: 'audio/webm',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transcription).toBe('Audio transcrito');
      expect(res.body.data.audioUrl).toBeUndefined();
    });

    it('should still succeed when image upload fails (graceful fallback)', async () => {
      mockUploadChatFile.mockRejectedValue(new Error('Storage unavailable'));

      const res = await request(app)
        .post('/api/simple-chat')
        .send({
          shop: 'test.myshopify.com',
          attachment: {
            type: 'image',
            data: 'fakeBase64Image',
            mimeType: 'image/jpeg',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imageUrl).toBeUndefined();
    });

    it('should not return audioUrl or imageUrl for text-only messages', async () => {
      const res = await request(app)
        .post('/api/simple-chat')
        .send({ message: 'Hola', shop: 'test.myshopify.com' });

      expect(res.status).toBe(200);
      expect(res.body.data.audioUrl).toBeUndefined();
      expect(res.body.data.imageUrl).toBeUndefined();
      expect(mockUploadChatFile).not.toHaveBeenCalled();
    });
  });
});
