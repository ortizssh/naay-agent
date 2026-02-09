import dotenv from 'dotenv';
import path from 'path';
import { AppConfig } from '@/types';

// Configure dotenv to look for .env file (only for development)
// In production (Azure), environment variables are set directly in App Service
if (process.env.NODE_ENV !== 'production') {
  const envPath = path.join(__dirname, '../../../config/.env');
  console.log('Loading .env file from:', envPath);
  dotenv.config({
    path: envPath,
  });
} else {
  console.log('Production mode: Using Azure App Service environment variables');
}

export const config: AppConfig = {
  shopify: {
    apiKey: process.env.SHOPIFY_API_KEY || '',
    apiSecret: process.env.SHOPIFY_API_SECRET || '',
    scopes: process.env.SHOPIFY_SCOPES || 'read_products,write_products',
    webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET || '',
    appUrl: process.env.SHOPIFY_APP_URL || 'http://localhost:3000',
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4',
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.JWT_SECRET || 'default-secret',
  },
  redis: {
    url:
      process.env.REDIS_ENABLED === 'false' ? undefined : process.env.REDIS_URL,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    enabled: process.env.REDIS_ENABLED !== 'false',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
};

export function validateConfig(): void {
  const required = [
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'OPENAI_API_KEY',
  ];

  // Optional but recommended for production security
  const optional = ['SHOPIFY_WEBHOOK_SECRET'];

  // Warn about missing optional variables
  const missingOptional = optional.filter(key => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn(
      '⚠️ Missing optional environment variables (recommended for security):',
      missingOptional
    );
  }

  // Log environment info for debugging
  console.log('🔍 Environment validation:', {
    NODE_ENV: process.env.NODE_ENV,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasShopifyKey: !!process.env.SHOPIFY_API_KEY,
    totalEnvVars: Object.keys(process.env).length,
    redisEnabled: process.env.REDIS_ENABLED,
    redisEnabledConfig: config.redis.enabled,
    hasRedisUrl: !!config.redis.url,
  });

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing);
    console.error(
      'Available env vars:',
      Object.keys(process.env).filter(
        k =>
          k.includes('SUPABASE') ||
          k.includes('SHOPIFY') ||
          k.includes('OPENAI')
      )
    );

    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `Check your Azure App Service Configuration settings.`
    );
  }

  console.log('✅ All required environment variables are present');
}
