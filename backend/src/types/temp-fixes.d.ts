// Temporal type fixes for quick deployment

declare module 'jsonwebtoken' {
  export function sign(payload: any, secret: string, options?: any): string;
  export function verify(token: string, secret: string): any;
}

declare module 'joi' {
  export function object(schema?: any): any;
  export function string(): any;
  export function number(): any;
  export function boolean(): any;
  export function array(): any;
}

declare module 'cors' {
  function cors(options?: any): any;
  export = cors;
}

declare module 'helmet' {
  function helmet(options?: any): any;
  export = helmet;
}

declare module 'express-rate-limit' {
  function rateLimit(options?: any): any;
  export = rateLimit;
}

declare module 'uuid' {
  export function v4(): string;
}

declare module 'openai' {
  export class OpenAI {
    constructor(config?: any);
    chat: {
      completions: {
        create(options: any): Promise<any>;
      };
    };
    embeddings: {
      create(options: any): Promise<any>;
    };
  }
}

declare module 'bullmq' {
  export class Queue {
    constructor(name: string, options?: any);
    add(name: string, data: any, options?: any): Promise<any>;
  }
  export class Worker {
    constructor(name: string, processor: any, options?: any);
    on(event: string, handler: any): void;
  }
}

declare module 'ioredis' {
  export class Redis {
    constructor(options?: any);
  }
  export default Redis;
}

declare module '@shopify/admin-api-client' {
  export function createAdminApiClient(options: any): any;
}

declare module '@shopify/storefront-api-client' {
  export function createStorefrontApiClient(options: any): any;
}

declare module '@supabase/supabase-js' {
  export function createClient(url: string, key: string): any;
}

declare module 'dotenv' {
  export function config(): void;
}

declare module 'winston' {
  export function createLogger(options: any): any;
  export const format: any;
  export const transports: any;
}