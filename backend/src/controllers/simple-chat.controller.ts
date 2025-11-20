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
          content: `Eres un asistente especializado en productos de cosmética natural de la marca Naay. 

Naay es una marca de cosmética ecológica funcional que se enfoca en:
- Productos naturales y sostenibles
- Cuidado facial y corporal
- Ingredientes botánicos de alta calidad
- Rutinas personalizadas de belleza

Responde de manera amigable, profesional y útil. Ayuda a los usuarios a:
- Encontrar productos adecuados para su tipo de piel
- Entender los beneficios de los ingredientes naturales
- Crear rutinas de cuidado personalizadas
- Responder preguntas sobre los productos

Mantén las respuestas concisas pero informativas. Usa un tono cálido y experto.`
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

export default router;