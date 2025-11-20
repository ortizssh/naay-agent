import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';

const router = Router();

// Simple OpenAI client
const apiKey = process.env.OPENAI_API_KEY || config.openai?.apiKey;

logger.info('Simple Chat Controller initialized', {
  hasApiKey: !!apiKey,
  apiKeyLength: apiKey?.length || 0,
  configSource: process.env.OPENAI_API_KEY ? 'env' : 'config'
});

const openai = new OpenAI({
  apiKey: apiKey,
});

// Simple chat endpoint that directly connects to OpenAI
router.post('/', async (req: Request, res: Response) => {
  try {
    const { message, shop } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    logger.info('Simple chat message received', {
      shop: shop || 'unknown',
      messageLength: message.length,
      hasApiKey: !!apiKey
    });

    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Direct OpenAI call
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `Eres un asistente de cosmética natural de Naay. Naay ofrece productos ecológicos funcionales con ingredientes botánicos de alta calidad.

REGLAS IMPORTANTES:
- Respuestas MUY concisas (máximo 3-4 oraciones cortas)
- Usa listas numeradas o con viñetas cuando sea apropiado
- Tono amigable pero directo
- Enfócate en lo esencial, evita redundancias

Ayuda con:
- Recomendaciones de productos para cada tipo de piel
- Beneficios de ingredientes naturales
- Rutinas de cuidado básicas
- Consejos de aplicación

Formato: Usa saltos de línea para separar ideas principales. Sé específico y práctico.`
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const response = completion.choices[0]?.message?.content || 
      '¡Hola! Soy tu asistente de Naay. ¿En qué puedo ayudarte con tu cuidado de la piel?';

    res.json({
      success: true,
      data: {
        response,
        conversationId: `simple_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }
    });

  } catch (error: any) {
    logger.error('Simple chat error:', {
      message: error?.message,
      type: error?.constructor?.name,
      status: error?.status,
      code: error?.code,
      hasApiKey: !!apiKey
    });

    // Specific error handling for OpenAI issues
    let errorMessage = 'Lo siento, hubo un problema al procesar tu mensaje. Por favor intenta de nuevo.';
    
    if (error?.message?.includes('API key')) {
      errorMessage = 'Error de configuración del servicio. Por favor contacta al administrador.';
    } else if (error?.status === 401) {
      errorMessage = 'Error de autenticación con el servicio de IA.';
    } else if (error?.status === 429) {
      errorMessage = 'El servicio está muy ocupado. Por favor intenta en unos momentos.';
    }
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      data: {
        response: errorMessage,
        conversationId: null,
        debug: process.env.NODE_ENV === 'development' ? {
          hasApiKey: !!apiKey,
          errorType: error?.constructor?.name,
          errorMessage: error?.message
        } : undefined
      }
    });
  }
});

// Test endpoint to check OpenAI configuration
router.get('/test', async (req: Request, res: Response) => {
  try {
    logger.info('Testing OpenAI configuration');
    
    if (!apiKey) {
      return res.json({
        success: false,
        error: 'OpenAI API key not configured',
        hasApiKey: false
      });
    }

    // Simple test call
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 10
    });

    res.json({
      success: true,
      message: 'OpenAI API is working correctly',
      hasApiKey: true,
      testResponse: completion.choices[0]?.message?.content
    });

  } catch (error: any) {
    logger.error('OpenAI test failed:', error);
    
    res.json({
      success: false,
      error: error?.message || 'Unknown error',
      hasApiKey: !!apiKey,
      errorType: error?.constructor?.name,
      status: error?.status
    });
  }
});

// Debug endpoint to check configuration and CORS
router.get('/debug', async (req: Request, res: Response) => {
  try {
    const envVars = {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      HAS_OPENAI_KEY: !!process.env.OPENAI_API_KEY,
      OPENAI_KEY_LENGTH: process.env.OPENAI_API_KEY?.length || 0,
      HAS_SUPABASE_URL: !!process.env.SUPABASE_URL,
      HAS_SHOPIFY_KEY: !!process.env.SHOPIFY_API_KEY
    };

    const corsHeaders = {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': res.getHeader('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': res.getHeader('Access-Control-Allow-Headers')
    };

    const requestInfo = {
      method: req.method,
      url: req.url,
      origin: req.get('Origin'),
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type')
    };

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: envVars,
      cors: corsHeaders,
      request: requestInfo,
      apiKeyConfigured: !!apiKey,
      apiKeySource: process.env.OPENAI_API_KEY ? 'env' : 'config'
    });

  } catch (error: any) {
    logger.error('Debug endpoint error:', error);
    
    res.status(500).json({
      success: false,
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint to verify CORS and environment configuration
router.get('/debug', async (req: Request, res: Response) => {
  try {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
    });

    res.json({
      success: true,
      environment: process.env.NODE_ENV,
      hasOpenAIKey: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      corsHeaders: {
        origin: req.headers.origin,
        method: req.method,
        userAgent: req.headers['user-agent']
      },
      timestamp: new Date().toISOString(),
      azureInfo: {
        websiteSiteName: process.env.WEBSITE_SITE_NAME,
        websiteInstanceId: process.env.WEBSITE_INSTANCE_ID
      }
    });

  } catch (error: any) {
    logger.error('Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;