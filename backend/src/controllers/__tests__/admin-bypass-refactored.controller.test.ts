import request from 'supertest';
import express from 'express';
import adminBypassRouter from '../admin-bypass-refactored.controller';
import { SupabaseService } from '@/services/supabase.service';
import { QueueService } from '@/services/queue.service';
import { AdminAnalyticsService } from '@/services/admin-analytics.service';
import { AdminSettingsService } from '@/services/admin-settings.service';
import { AdminWebhooksService } from '@/services/admin-webhooks.service';

// Mock all services
jest.mock('@/services/supabase.service');
jest.mock('@/services/queue.service');
jest.mock('@/services/admin-analytics.service');
jest.mock('@/services/admin-settings.service');
jest.mock('@/services/admin-webhooks.service');
jest.mock('@/middleware/rateLimiter', () => ({
  adminBypassRateLimit: jest.fn((req, res, next) => next()),
}));

describe('Admin Bypass Controller', () => {
  let app: express.Application;
  let mockSupabaseService: jest.Mocked<SupabaseService>;
  let mockQueueService: jest.Mocked<QueueService>;
  let mockAnalyticsService: jest.Mocked<AdminAnalyticsService>;
  let mockSettingsService: jest.Mocked<AdminSettingsService>;
  let mockWebhooksService: jest.Mocked<AdminWebhooksService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin-bypass', adminBypassRouter);

    // Setup mocks
    mockSupabaseService = new SupabaseService() as jest.Mocked<SupabaseService>;
    mockQueueService = new QueueService() as jest.Mocked<QueueService>;
    mockAnalyticsService = new AdminAnalyticsService() as jest.Mocked<AdminAnalyticsService>;
    mockSettingsService = new AdminSettingsService() as jest.Mocked<AdminSettingsService>;
    mockWebhooksService = new AdminWebhooksService() as jest.Mocked<AdminWebhooksService>;

    jest.clearAllMocks();
  });

  describe('POST /products/sync', () => {
    it('should sync products successfully', async () => {
      const mockStore = {
        id: 'store-123',
        domain: 'test-shop.myshopify.com',
        access_token: 'token-123',
      };

      mockSupabaseService.getStore = jest.fn().mockResolvedValue(mockStore);
      mockQueueService.addFullSyncJob = jest.fn().mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/admin-bypass/products/sync')
        .send({ shop: 'test-shop.myshopify.com' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Sincronización de productos iniciada correctamente',
        shop: 'test-shop.myshopify.com',
      });
      expect(mockQueueService.addFullSyncJob).toHaveBeenCalledWith(
        'test-shop.myshopify.com',
        'token-123'
      );
    });

    it('should return 400 when shop parameter is missing', async () => {
      const response = await request(app)
        .post('/api/admin-bypass/products/sync')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Shop parameter required',
      });
    });

    it('should return 404 when store not found', async () => {
      mockSupabaseService.getStore = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin-bypass/products/sync')
        .send({ shop: 'nonexistent-shop.myshopify.com' });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Store not found',
      });
    });
  });

  describe('GET /settings', () => {
    it('should return shop settings successfully', async () => {
      const mockSettings = {
        widget_enabled: true,
        widget_color: '#a59457',
        language: 'es',
      };

      mockSettingsService.getShopSettings = jest.fn().mockResolvedValue(mockSettings);

      const response = await request(app)
        .get('/api/admin-bypass/settings?shop=test-shop.myshopify.com');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: mockSettings,
      });
    });

    it('should return 400 when shop parameter is missing', async () => {
      const response = await request(app)
        .get('/api/admin-bypass/settings');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Shop parameter required',
      });
    });
  });

  describe('POST /settings/update', () => {
    it('should update settings successfully', async () => {
      const mockUpdatedSettings = {
        widget_enabled: false,
        widget_color: '#ff0000',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      mockSettingsService.updateShopSettings = jest.fn().mockResolvedValue(mockUpdatedSettings);

      const response = await request(app)
        .post('/api/admin-bypass/settings/update')
        .send({
          shop: 'test-shop.myshopify.com',
          widget_enabled: false,
          widget_color: '#ff0000',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: mockUpdatedSettings,
        message: 'Configuración actualizada correctamente',
      });
    });
  });

  describe('GET /stats', () => {
    it('should return shop statistics successfully', async () => {
      const mockStats = {
        totalProducts: 50,
        totalConversations: 25,
        totalMessages: 100,
        conversationsByDay: [
          { date: '2024-01-01', count: 10 },
          { date: '2024-01-02', count: 15 },
        ],
      };

      mockAnalyticsService.getShopStats = jest.fn().mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/admin-bypass/stats?shop=test-shop.myshopify.com');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: mockStats,
      });
    });
  });

  describe('GET /webhooks/stats', () => {
    it('should return webhook statistics successfully', async () => {
      const mockWebhookStats = {
        totalEvents: 100,
        eventsByType: {
          'products/create': 30,
          'products/update': 50,
          'products/delete': 20,
        },
        successRate: 95,
        recentEvents: [],
      };

      mockWebhooksService.getWebhookStats = jest.fn().mockResolvedValue(mockWebhookStats);

      const response = await request(app)
        .get('/api/admin-bypass/webhooks/stats?shop=test-shop.myshopify.com');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: mockWebhookStats,
      });
    });
  });

  describe('POST /webhooks/create', () => {
    it('should create webhooks successfully', async () => {
      const mockResult = {
        success: true,
        message: 'Successfully created 4 webhooks',
        webhooks: [
          { id: '1', topic: 'products/create' },
          { id: '2', topic: 'products/update' },
        ],
      };

      mockWebhooksService.createWebhooks = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/admin-bypass/webhooks/create')
        .send({ shop: 'test-shop.myshopify.com' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject(mockResult);
    });
  });

  describe('POST /webhooks/test', () => {
    it('should test webhook successfully', async () => {
      const mockTestResult = {
        success: true,
        webhook_id: 'test-123',
        message: 'Test webhook event created successfully for topic: products/create',
      };

      mockWebhooksService.testWebhook = jest.fn().mockResolvedValue(mockTestResult);

      const response = await request(app)
        .post('/api/admin-bypass/webhooks/test')
        .send({
          shop: 'test-shop.myshopify.com',
          topic: 'products/create',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject(mockTestResult);
    });

    it('should return 400 when parameters are missing', async () => {
      const response = await request(app)
        .post('/api/admin-bypass/webhooks/test')
        .send({ shop: 'test-shop.myshopify.com' }); // missing topic

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Shop and topic parameters required',
      });
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/admin-bypass/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Admin bypass controller is healthy',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});