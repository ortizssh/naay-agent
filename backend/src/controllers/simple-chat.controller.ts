import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';
import { SupabaseService } from '@/services/supabase.service';

const router = Router();

// Simple OpenAI client
const apiKey = process.env.OPENAI_API_KEY || config.openai?.apiKey;

logger.info('Simple Chat Controller initialized', {
  hasApiKey: !!apiKey,
  apiKeyLength: apiKey?.length || 0,
  configSource: process.env.OPENAI_API_KEY ? 'env' : 'config',
});

const openai = new OpenAI({
  apiKey: apiKey,
});

const supabaseService = new SupabaseService();

// In-memory conversation store (for simple implementation)
// In production, this should use a proper database or cache
const conversationStore: Record<string, Array<{ role: string; content: string }>> = {};

// Simple chat endpoint that directly connects to OpenAI
router.post('/', async (req: Request, res: Response) => {
  try {
    const { message, shop, conversationId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
      });
    }

    // Generate conversation ID if not provided
    const currentConversationId = conversationId || `simple_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Simple chat message received', {
      shop: shop || 'unknown',
      conversationId: currentConversationId,
      messageLength: message.length,
      hasApiKey: !!apiKey,
      hasHistory: !!conversationStore[currentConversationId],
    });

    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Get or initialize conversation history
    if (!conversationStore[currentConversationId]) {
      conversationStore[currentConversationId] = [];
    }

    // Add current user message to conversation history
    conversationStore[currentConversationId].push({
      role: 'user',
      content: message,
    });

    // Keep conversation history manageable (last 20 messages)
    if (conversationStore[currentConversationId].length > 20) {
      conversationStore[currentConversationId] = conversationStore[currentConversationId].slice(-20);
    }

    // Prepare messages for OpenAI (system prompt + conversation history)
    const messages = [
      {
        role: 'system',
        content: `#### 💬 **Rol del Agente**

Eres **Naáy Assistant**, el asesor virtual de **Naáy**, marca española de cosmética natural y ecológica fundada en Valladolid. Tu misión es ofrecer orientación personalizada sobre el cuidado de la piel y el uso de productos Naáy, reflejando siempre el tono cálido, cercano, profesional y respetuoso con el medio ambiente que caracteriza a la marca.

---

#### 🌿 **Personalidad y tono**

* Cálido, empático y educativo
* Profesional, pero accesible
* Natural y confiable, sin tecnicismos excesivos
* Inspirado en el bienestar y respeto por el cuerpo y la naturaleza

Ejemplo de tono:

> "Tu piel merece respirar y sentirse en calma. Te ayudaré a elegir una rutina que la cuide con ingredientes naturales, como hacemos en Naáy desde hace más de una década."

---

#### 🧴 **Conocimientos base**

* Cosmética natural y ecológica certificada (sin parabenos, siliconas, derivados del petróleo, alcohol ni sales).
* Tipos de piel: seca, grasa, mixta, sensible, con dermatitis, rosácea, psoriasis, etc.
* Ingredientes naturales comunes en los productos Naáy (aloe vera, manzanilla, caléndula, rosa mosqueta, etc.).
* Beneficios dermatológicos de cada línea de producto (facial, corporal, capilar, bebés, higiene personal).
* Certificaciones ecológicas europeas y valores éticos (no testado en animales, sostenibilidad).

---

#### 🪄 **Funciones principales**

1. **Asesor dermatológico personalizado:** recomendar productos según tipo de piel, edad y necesidades.
2. **Educador ecológico:** explicar la importancia de los ingredientes naturales y las certificaciones ecológicas.
3. **Asistente de compra:** guiar al usuario en el proceso de elección y uso correcto de cada producto.
4. **Embajador de marca:** transmitir los valores de respeto al cuerpo, a la familia y al medio ambiente.
5. **Atención postventa:** resolver dudas sobre combinaciones, alergias o rutinas.

---

#### 🧠 **Estructura de razonamiento**

Cuando un usuario interactúe:

1. Identifica su **tipo de piel** y necesidades (sensibilidad, hidratación, regeneración, etc.).
2. Sugiere una rutina **personalizada** (limpieza, hidratación, nutrición, protección).
3. Explica **por qué** se recomiendan esos productos y **qué los hace diferentes**.
4. Ofrece un consejo ecológico o de bienestar complementario.

---

#### ⚙️ **Ejemplo de diálogo**

**Usuario:** Tengo la piel muy sensible y últimamente me arde con cualquier crema. ¿Qué puedo usar?
**Naáy Assistant:** Entiendo lo molesto que puede ser. En Naáy formulamos productos especialmente para pieles como la tuya, con ingredientes naturales calmantes como aloe vera y caléndula. Te recomiendo nuestra **Crema Facial Calmante de Aloe & Caléndula**, libre de alcohol y parabenos, ideal para reducir la irritación y fortalecer la barrera natural de tu piel. 🌿

---

#### 🌍 **Valores esenciales**

* Respeto al cuerpo y la naturaleza.
* Cuidado de toda la familia.
* Innovación basada en experiencia (más de 18 años en cosmética ecológica).
* Colaboración con hospitales y asociaciones dermatológicas.
* Producción sostenible y ética.

**DEBES UTILIZAR LA BASE DE DATOS VECTORIAL EN TUS HERRAMIENTAS CADA VEZ QUE RESPONDAS UN MENSAJE**`,
        },
        ...conversationStore[currentConversationId], // Include conversation history
    ];

    // Direct OpenAI call with conversation context
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const response =
      completion.choices[0]?.message?.content ||
      '¡Hola! Soy tu asistente de Naay. ¿En qué puedo ayudarte con tu cuidado de la piel?';

    // Store assistant's response in conversation history
    conversationStore[currentConversationId].push({
      role: 'assistant',
      content: response,
    });

    res.json({
      success: true,
      data: {
        response,
        conversationId: currentConversationId, // Return the same conversation ID
      },
    });
  } catch (error: any) {
    logger.error('Simple chat error:', {
      message: error?.message,
      type: error?.constructor?.name,
      status: error?.status,
      code: error?.code,
      hasApiKey: !!apiKey,
    });

    // Specific error handling for OpenAI issues
    let errorMessage =
      'Lo siento, hubo un problema al procesar tu mensaje. Por favor intenta de nuevo.';

    if (error?.message?.includes('API key')) {
      errorMessage =
        'Error de configuración del servicio. Por favor contacta al administrador.';
    } else if (error?.status === 401) {
      errorMessage = 'Error de autenticación con el servicio de IA.';
    } else if (error?.status === 429) {
      errorMessage =
        'El servicio está muy ocupado. Por favor intenta en unos momentos.';
    }

    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      data: {
        response: errorMessage,
        conversationId: null,
        debug:
          process.env.NODE_ENV === 'development'
            ? {
                hasApiKey: !!apiKey,
                errorType: error?.constructor?.name,
                errorMessage: error?.message,
              }
            : undefined,
      },
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
        hasApiKey: false,
      });
    }

    // Simple test call
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 10,
    });

    res.json({
      success: true,
      message: 'OpenAI API is working correctly',
      hasApiKey: true,
      testResponse: completion.choices[0]?.message?.content,
    });
  } catch (error: any) {
    logger.error('OpenAI test failed:', error);

    res.json({
      success: false,
      error: error?.message || 'Unknown error',
      hasApiKey: !!apiKey,
      errorType: error?.constructor?.name,
      status: error?.status,
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
      HAS_SHOPIFY_KEY: !!process.env.SHOPIFY_API_KEY,
    };

    const corsHeaders = {
      'Access-Control-Allow-Origin': res.getHeader(
        'Access-Control-Allow-Origin'
      ),
      'Access-Control-Allow-Methods': res.getHeader(
        'Access-Control-Allow-Methods'
      ),
      'Access-Control-Allow-Headers': res.getHeader(
        'Access-Control-Allow-Headers'
      ),
    };

    const requestInfo = {
      method: req.method,
      url: req.url,
      origin: req.get('Origin'),
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type'),
    };

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: envVars,
      cors: corsHeaders,
      request: requestInfo,
      apiKeyConfigured: !!apiKey,
      apiKeySource: process.env.OPENAI_API_KEY ? 'env' : 'config',
    });
  } catch (error: any) {
    logger.error('Debug endpoint error:', error);

    res.status(500).json({
      success: false,
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Debug endpoint to verify CORS and environment configuration
router.get('/debug', async (req: Request, res: Response) => {
  try {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-Requested-With',
    });

    res.json({
      success: true,
      environment: process.env.NODE_ENV,
      hasOpenAIKey: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      corsHeaders: {
        origin: req.headers.origin,
        method: req.method,
        userAgent: req.headers['user-agent'],
      },
      timestamp: new Date().toISOString(),
      azureInfo: {
        websiteSiteName: process.env.WEBSITE_SITE_NAME,
        websiteInstanceId: process.env.WEBSITE_INSTANCE_ID,
      },
    });
  } catch (error: any) {
    logger.error('Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
