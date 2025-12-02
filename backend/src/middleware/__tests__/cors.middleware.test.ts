import { Request, Response, NextFunction } from 'express';
import { CorsMiddleware } from '../cors.middleware';

describe('CorsMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;
  let mockHeaders: Record<string, string>;

  beforeEach(() => {
    mockHeaders = {};
    
    mockReq = {
      get: jest.fn((header: string) => {
        if (header === 'Origin') return mockReq.origin;
        return undefined;
      }),
      path: '',
      method: 'GET',
    };

    mockRes = {
      setHeader: jest.fn((name: string, value: string) => {
        mockHeaders[name] = value;
      }),
      removeHeader: jest.fn((name: string) => {
        delete mockHeaders[name];
      }),
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
    };

    mockNext = jest.fn();
  });

  describe('widgetScript', () => {
    it('should set permissive CORS headers for widget script', () => {
      mockReq.path = '/static/naay-widget.js';
      
      const middleware = CorsMiddleware.widgetScript();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'ALLOWALL');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not modify headers for non-widget paths', () => {
      mockReq.path = '/static/other-file.js';
      
      const middleware = CorsMiddleware.widgetScript();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('widgetApi', () => {
    it('should set CORS headers for widget API endpoints', () => {
      mockReq.path = '/api/widget/test';
      
      const middleware = CorsMiddleware.widgetApi();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle OPTIONS preflight for widget API', () => {
      mockReq.path = '/api/widget/test';
      mockReq.method = 'OPTIONS';
      
      const middleware = CorsMiddleware.widgetApi();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.end).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('chatApi', () => {
    it('should allow valid Shopify domain', () => {
      mockReq.path = '/api/chat/test';
      (mockReq as any).origin = 'https://test-store.myshopify.com';
      
      const middleware = CorsMiddleware.chatApi();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://test-store.myshopify.com');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Vary', 'Origin');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject invalid origin', () => {
      mockReq.path = '/api/chat/test';
      (mockReq as any).origin = 'https://malicious-site.com';
      
      const middleware = CorsMiddleware.chatApi();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://malicious-site.com');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow requests without origin', () => {
      mockReq.path = '/api/chat/test';
      
      const middleware = CorsMiddleware.chatApi();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle simple-chat path', () => {
      mockReq.path = '/api/simple-chat/test';
      (mockReq as any).origin = 'https://admin.shopify.com';
      
      const middleware = CorsMiddleware.chatApi();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://admin.shopify.com');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('publicApi', () => {
    it('should allow Shopify domains for public API', () => {
      mockReq.path = '/api/public/test';
      (mockReq as any).origin = 'https://test-store.shopify.com';
      
      const middleware = CorsMiddleware.publicApi();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://test-store.shopify.com');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow custom store domains', () => {
      mockReq.path = '/api/public/test';
      (mockReq as any).origin = 'https://example-store.com';
      
      const middleware = CorsMiddleware.publicApi();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example-store.com');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow more HTTP methods for public API', () => {
      mockReq.path = '/api/public/test';
      
      const middleware = CorsMiddleware.publicApi();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('general', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      delete process.env.NODE_ENV;
    });

    it('should allow localhost origins in development', () => {
      (mockReq as any).origin = 'http://localhost:3000';
      
      const middleware = CorsMiddleware.general();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:3000');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle OPTIONS preflight', () => {
      mockReq.method = 'OPTIONS';
      
      const middleware = CorsMiddleware.general();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.end).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('frameOptions', () => {
    it('should set frame options for non-widget files', () => {
      mockReq.path = '/admin';
      
      const middleware = CorsMiddleware.frameOptions();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'ALLOWALL');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        "frame-ancestors 'self' https://*.shopify.com https://*.shop.app https://admin.shopify.com https://*.myshopify.com;"
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not set frame options for widget files', () => {
      mockReq.path = '/static/naay-widget.js';
      
      const middleware = CorsMiddleware.frameOptions();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });
});