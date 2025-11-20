import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';

const router = Router();

// Simple OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || config.openai?.apiKey,
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
      messageLength: message.length
    });

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

  } catch (error) {
    logger.error('Simple chat error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      data: {
        response: 'Lo siento, hubo un problema al procesar tu mensaje. Por favor intenta de nuevo.',
        conversationId: null
      }
    });
  }
});

export default router;