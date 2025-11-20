import { AIAgentService } from './ai-agent.service';
import { EmbeddingService } from './embedding.service';
import { SupabaseService } from './supabase.service';

// Mock dependencies
jest.mock('./embedding.service');
jest.mock('./supabase.service');
jest.mock('openai');

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn()
    }
  }
};

const mockOpenAIConstructor = jest.fn().mockImplementation(() => mockOpenAI);

jest.mock('openai', () => ({
  __esModule: true,
  default: mockOpenAIConstructor
}));

describe('AIAgentService', () => {
  let service: AIAgentService;
  let mockEmbeddingService: jest.Mocked<EmbeddingService>;
  let mockSupabaseService: jest.Mocked<SupabaseService>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create service instance
    service = new AIAgentService();

    // Get mocked instances
    mockEmbeddingService = EmbeddingService.prototype as jest.Mocked<EmbeddingService>;
    mockSupabaseService = SupabaseService.prototype as jest.Mocked<SupabaseService>;
  });

  describe('processMessage', () => {
    it('should process a product search intent', async () => {
      const mockMessage = 'Busco vestidos rojos';
      const mockSessionId = 'session-123';
      const mockShop = 'test-shop.myshopify.com';

      // Mock intent analysis
      const mockIntentAnalysis = {
        intent: 'search_products',
        confidence: 0.9,
        entities: { product: 'vestidos', color: 'rojos' },
        context: {}
      };

      // Mock search results
      const mockSearchResults = [
        {
          id: '1',
          title: 'Vestido Rojo Elegante',
          description_text: 'Hermoso vestido rojo para ocasiones especiales',
          price: 89.99,
          available: true,
          similarity: 0.85,
          images: ['image1.jpg'],
          variants: []
        }
      ];

      // Setup mocks
      mockSupabaseService.searchProducts = jest.fn().mockResolvedValue(mockSearchResults);
      mockSupabaseService.getSessionHistory = jest.fn().mockResolvedValue([]);
      mockSupabaseService.saveChatMessage = jest.fn().mockResolvedValue({ id: 'msg-1' });
      mockSupabaseService.updateSessionActivity = jest.fn().mockResolvedValue(undefined);

      // Mock the private methods
      jest.spyOn(service as any, 'analyzeIntent').mockResolvedValue(mockIntentAnalysis);
      jest.spyOn(service as any, 'handleProductSearch').mockResolvedValue({
        messages: ['Encontré estos vestidos rojos para ti...'],
        actions: [],
        metadata: { products_found: 1 }
      });

      const result = await service.processMessage(mockMessage, mockSessionId, mockShop);

      expect(result).toHaveProperty('messages');
      expect(result).toHaveProperty('actions');
      expect(Array.isArray(result.messages)).toBe(true);
      expect(result.messages.length).toBeGreaterThan(0);
    });

    it('should handle add to cart intent', async () => {
      const mockMessage = 'Agrega el vestido rojo a mi carrito';
      const mockSessionId = 'session-456';
      const mockShop = 'test-shop.myshopify.com';

      const mockIntentAnalysis = {
        intent: 'add_to_cart',
        confidence: 0.95,
        entities: { product: 'vestido rojo' },
        context: {}
      };

      // Setup mocks
      mockSupabaseService.getSessionHistory = jest.fn().mockResolvedValue([]);
      mockSupabaseService.saveChatMessage = jest.fn().mockResolvedValue({ id: 'msg-1' });
      mockSupabaseService.updateSessionActivity = jest.fn().mockResolvedValue(undefined);

      jest.spyOn(service as any, 'analyzeIntent').mockResolvedValue(mockIntentAnalysis);
      jest.spyOn(service as any, 'handleAddToCart').mockResolvedValue({
        messages: ['Agregué el vestido rojo a tu carrito'],
        actions: [{ type: 'cart.add', params: { productId: '123' } }],
        metadata: { intent: 'add_to_cart' }
      });

      const result = await service.processMessage(mockMessage, mockSessionId, mockShop);

      expect(result.messages[0]).toContain('carrito');
      expect(result.actions).toBeDefined();
      expect(result.actions.length).toBeGreaterThan(0);
    });

    it('should provide fallback response for unknown intents', async () => {
      const mockMessage = 'Mensaje confuso sin sentido claro';
      const mockSessionId = 'session-789';
      const mockShop = 'test-shop.myshopify.com';

      const mockIntentAnalysis = {
        intent: 'unknown',
        confidence: 0.3,
        entities: {},
        context: {}
      };

      // Setup mocks
      mockSupabaseService.getSessionHistory = jest.fn().mockResolvedValue([]);
      mockSupabaseService.saveChatMessage = jest.fn().mockResolvedValue({ id: 'msg-1' });
      mockSupabaseService.updateSessionActivity = jest.fn().mockResolvedValue(undefined);

      jest.spyOn(service as any, 'analyzeIntent').mockResolvedValue(mockIntentAnalysis);
      jest.spyOn(service as any, 'handleUnknownIntent').mockResolvedValue({
        messages: ['Lo siento, no entendí tu mensaje. ¿Puedes ser más específico?'],
        actions: [],
        metadata: { intent: 'unknown' }
      });

      const result = await service.processMessage(mockMessage, mockSessionId, mockShop);

      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.actions).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      const mockMessage = 'Hola';
      const mockSessionId = 'session-999';
      const mockShop = 'test-shop.myshopify.com';

      // Setup mocks
      mockSupabaseService.getSessionHistory = jest.fn().mockResolvedValue([]);
      mockSupabaseService.saveChatMessage = jest.fn().mockResolvedValue({ id: 'msg-1' });
      mockSupabaseService.updateSessionActivity = jest.fn().mockResolvedValue(undefined);

      // Mock intent analysis to throw error
      jest.spyOn(service as any, 'analyzeIntent').mockRejectedValue(new Error('API Error'));

      const result = await service.processMessage(mockMessage, mockSessionId, mockShop);

      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.metadata?.error).toBeDefined();
    });
  });

  describe('Intent Analysis', () => {
    it('should correctly identify product search intent', async () => {
      const message = '¿Tienen zapatos deportivos?';

      const result = await (service as any).analyzeIntent(message);

      expect(result.intent).toBe('search_products');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.entities).toHaveProperty('product');
    });

    it('should identify cart operations', async () => {
      const message = 'Quiero agregar este producto al carrito';

      const result = await (service as any).analyzeIntent(message);

      expect(result.intent).toBe('add_to_cart');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should handle general inquiries', async () => {
      const message = '¿Cuál es su política de devoluciones?';

      const result = await (service as any).analyzeIntent(message);

      expect(result.intent).toBe('general_inquiry');
      expect(result.confidence).toBeGreaterThan(0.3);
    });
  });

  describe('Product Search Handler', () => {
    it('should return formatted product recommendations', async () => {
      const mockIntentAnalysis = {
        intent: 'search_products',
        entities: { product: 'zapatos', size: '42' },
        context: {},
        confidence: 0.8
      };

      const mockProducts = [
        {
          id: '1',
          title: 'Zapatos Deportivos Nike',
          description_text: 'Excelentes zapatos para running',
          price: 129.99,
          available: true,
          similarity: 0.9,
          images: ['nike-shoes.jpg'],
          variants: [{ title: 'Talla 42', price: 129.99, available: true }]
        }
      ];

      mockSupabaseService.searchProducts = jest.fn().mockResolvedValue(mockProducts);

      const result = await (service as any).handleProductSearch('zapatos', 'test-shop', mockIntentAnalysis);

      expect(result.messages[0]).toContain('Nike');
      expect(result.messages[0]).toContain('$129.99');
      expect(result.actions).toBeDefined();
    });

    it('should handle empty search results', async () => {
      const mockIntentAnalysis = {
        intent: 'search_products',
        entities: { product: 'producto inexistente' },
        context: {},
        confidence: 0.8
      };

      mockSupabaseService.searchProducts = jest.fn().mockResolvedValue([]);

      const result = await (service as any).handleProductSearch('producto inexistente', 'test-shop', mockIntentAnalysis);

      expect(result.messages[0]).toContain('couldn\'t find');
      expect(result.actions).toEqual([]);
    });
  });

  describe('Cart Operations', () => {
    it('should handle add to cart requests', async () => {
      const mockIntentAnalysis = {
        intent: 'add_to_cart',
        entities: { product: 'vestido rojo', quantity: 1 },
        context: {},
        confidence: 0.9
      };

      const result = await (service as any).handleAddToCart('agrega vestido rojo', 'test-shop', undefined, mockIntentAnalysis);

      // Since cart functionality is not fully implemented, we expect a helpful message
      expect(result).toHaveProperty('messages');
      expect(result).toHaveProperty('actions');
      expect(result.messages[0]).toContain('carrito');
    });

    it('should handle view cart requests', async () => {
      const result = await (service as any).handleViewCart('test-shop');

      expect(result.messages[0]).toContain('cart');
      expect(result.actions).toBeDefined();
    });
  });

  describe('Conversation Management', () => {
    it('should save conversation turns', async () => {
      const userMessage = 'Hola';
      const aiResponse = '¡Hola! ¿En qué puedo ayudarte?';
      const metadata = {
        intent: 'greeting',
        confidence: 0.9
      };

      mockSupabaseService.saveChatMessage = jest.fn().mockResolvedValue({ id: 'msg_123' });

      await (service as any).saveConversationTurn('session_123', userMessage, aiResponse, metadata);

      expect(mockSupabaseService.saveChatMessage).toHaveBeenCalledWith(
        { session_id: 'session_123', role: 'user', content: 'Hola', metadata: { timestamp: expect.any(Date) } }
      );
      expect(mockSupabaseService.saveChatMessage).toHaveBeenCalledWith(
        { session_id: 'session_123', role: 'assistant', content: '¡Hola! ¿En qué puedo ayudarte?', metadata: { ...metadata, timestamp: expect.any(Date) } }
      );
    });
  });
});