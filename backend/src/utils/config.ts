import dotenv from 'dotenv';
import path from 'path';
import { AppConfig } from '@/types';

// Configure dotenv to look for .env file in the backend directory
dotenv.config({ 
  path: process.env.NODE_ENV === 'production' 
    ? path.join(__dirname, '../../.env') 
    : path.join(__dirname, '../../.env') // Load from backend/.env
});

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
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    enabled: process.env.REDIS_ENABLED !== 'false',
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

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}
