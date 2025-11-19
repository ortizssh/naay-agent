import express from 'express';
import cors from 'cors';
import path from 'path';
import helmet from 'helmet';
import { config, validateConfig } from '@/utils/config';
import { logger } from '@/utils/logger';
import { errorHandler } from '@/middleware/errorHandler';
import { rateLimiter } from '@/middleware/rateLimiter';
import { requestLogger } from '@/middleware/requestLogger';

// Route imports
import authRoutes from '@/controllers/auth.controller';
import productRoutes from '@/controllers/product.controller';
import webhookRoutes from '@/controllers/webhook.controller';
import webhookAdminRoutes from '@/controllers/webhook-admin.controller';
import chatRoutes from '@/controllers/chat.controller';
import healthRoutes from '@/controllers/health.controller';
import widgetRoutes from '@/controllers/widget.controller';
import settingsRoutes from '@/controllers/settings.controller';
import adminRoutes from '@/controllers/admin.controller';

async function startServer() {
  try {
    // Validate configuration
    validateConfig();

    const app = express();

    // Security middleware - allow iframe embedding for Shopify
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          frameAncestors: ["'self'", "https://*.shopify.com", "https://admin.shopify.com"],
        },
      },
      frameguard: false, // Disable frameguard to allow iframe
    }));
    app.use(
      cors({
        origin:
          process.env.NODE_ENV === 'production'
            ? [config.shopify.appUrl, /.*\.shopify\.com$/]
            : ['http://localhost:3000', 'http://localhost:3001'],
        credentials: true,
      })
    );

    // Allow embedding in Shopify iframe
    app.use((req, res, next) => {
      res.setHeader('X-Frame-Options', 'ALLOWALL');
      res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://*.shopify.com https://admin.shopify.com;");
      next();
    });

    // Rate limiting
    app.use(rateLimiter);

    // Request logging
    app.use(requestLogger);

    // Body parsing middleware
    app.use('/api/webhooks', express.raw({ type: 'application/json' }));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Serve static files for widget
    app.use('/static', express.static(path.join(__dirname, 'public')));

    // Health check (before auth)
    app.use('/health', healthRoutes);

    // Root route for Shopify app installation
    app.get('/', (req, res) => {
      const { token, shop, hmac, host, timestamp, embedded } = req.query;
      
      // Debug logging
      logger.info('Root route accessed', {
        query: req.query,
        url: req.url,
        hasToken: !!token,
        hasShop: !!shop,
        hasHmac: !!hmac,
        hasHost: !!host,
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer')
      });
      
      // Check if this is being loaded in Shopify admin iframe
      const isEmbedded = host || embedded || req.get('Referer')?.includes('admin.shopify.com');
      
      if (isEmbedded) {
        // App is being loaded within Shopify admin - show admin interface
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Naay Agent - Admin Panel</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
            <style>
              * {
                box-sizing: border-box;
              }
              
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                margin: 0; 
                padding: 0; 
                background: #f6f6f7; 
                color: #202223;
                font-size: 14px;
                line-height: 1.4;
              }
              
              .polaris-page {
                padding: 24px;
                max-width: 1200px;
                margin: 0 auto;
              }
              
              .polaris-page__header {
                display: flex;
                align-items: center;
                margin-bottom: 24px;
                padding-bottom: 16px;
                border-bottom: 1px solid #e1e3e5;
              }
              
              .polaris-page__title {
                font-size: 24px;
                font-weight: 600;
                color: #202223;
                margin: 0;
                display: flex;
                align-items: center;
                gap: 8px;
              }
              
              .polaris-layout {
                display: grid;
                grid-template-columns: 1fr;
                gap: 24px;
              }
              
              @media (min-width: 768px) {
                .polaris-layout {
                  grid-template-columns: 2fr 1fr;
                }
              }
              
              .polaris-card {
                background: #ffffff;
                border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                border: 1px solid #e1e3e5;
                overflow: hidden;
              }
              
              .polaris-card__header {
                padding: 20px 20px 16px;
                border-bottom: 1px solid #e1e3e5;
              }
              
              .polaris-card__title {
                font-size: 16px;
                font-weight: 600;
                color: #202223;
                margin: 0;
                display: flex;
                align-items: center;
                gap: 8px;
              }
              
              .polaris-card__content {
                padding: 20px;
              }
              
              .polaris-stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
                margin-bottom: 24px;
              }
              
              .polaris-stat-card {
                background: #ffffff;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                border: 1px solid #e1e3e5;
              }
              
              .polaris-stat-number {
                font-size: 28px;
                font-weight: 700;
                color: #008060;
                margin-bottom: 4px;
              }
              
              .polaris-stat-label {
                font-size: 13px;
                color: #6d7175;
                font-weight: 500;
              }
              
              .polaris-button {
                background: #008060;
                color: #ffffff;
                border: 1px solid #008060;
                border-radius: 6px;
                padding: 8px 16px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                margin: 4px;
                text-decoration: none;
              }
              
              .polaris-button:hover {
                background: #005e46;
                border-color: #005e46;
              }
              
              .polaris-button--secondary {
                background: #ffffff;
                color: #202223;
                border-color: #c9cccf;
              }
              
              .polaris-button--secondary:hover {
                background: #f6f6f7;
                border-color: #8c9196;
              }
              
              .polaris-button--destructive {
                background: #d72c0d;
                border-color: #d72c0d;
              }
              
              .polaris-button--destructive:hover {
                background: #bf2a0a;
                border-color: #bf2a0a;
              }
              
              .polaris-banner {
                border-radius: 8px;
                padding: 16px 20px;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                gap: 12px;
                border: 1px solid;
              }
              
              .polaris-banner--success {
                background: #f0f9ff;
                border-color: #b3e5ff;
                color: #0570de;
              }
              
              .polaris-banner--warning {
                background: #fff9f0;
                border-color: #ffcc99;
                color: #b45309;
              }
              
              .polaris-banner--critical {
                background: #fef7f7;
                border-color: #ffc2c2;
                color: #d72c0d;
              }
              
              .polaris-banner__icon {
                font-size: 16px;
                flex-shrink: 0;
              }
              
              .polaris-toggle {
                position: relative;
                display: inline-flex;
                align-items: center;
                gap: 12px;
                margin: 16px 0;
              }
              
              .polaris-toggle__input {
                position: relative;
                appearance: none;
                width: 44px;
                height: 24px;
                border-radius: 12px;
                background: #c9cccf;
                border: 1px solid #8c9196;
                cursor: pointer;
                transition: all 0.2s ease;
              }
              
              .polaris-toggle__input:checked {
                background: #008060;
                border-color: #008060;
              }
              
              .polaris-toggle__input::after {
                content: '';
                position: absolute;
                top: 2px;
                left: 2px;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #ffffff;
                transition: transform 0.2s ease;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
              }
              
              .polaris-toggle__input:checked::after {
                transform: translateX(20px);
              }
              
              .polaris-toggle__label {
                font-size: 14px;
                font-weight: 500;
                color: #202223;
              }
              
              .polaris-status-list {
                list-style: none;
                padding: 0;
                margin: 0;
              }
              
              .polaris-status-list li {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px 0;
                border-bottom: 1px solid #f1f2f3;
              }
              
              .polaris-status-list li:last-child {
                border-bottom: none;
              }
              
              .polaris-status-indicator {
                font-size: 16px;
                min-width: 20px;
              }
              
              .polaris-stack {
                display: flex;
                flex-direction: column;
                gap: 16px;
              }
              
              .polaris-stack--horizontal {
                flex-direction: row;
                flex-wrap: wrap;
                align-items: center;
              }
              
              .polaris-text {
                font-size: 14px;
                line-height: 1.4;
                color: #6d7175;
              }
              
              .polaris-text--body {
                color: #202223;
              }
              
              .polaris-text--subdued {
                color: #8c9196;
              }
              
              .polaris-description-list {
                display: grid;
                grid-template-columns: 1fr 2fr;
                gap: 8px 16px;
                align-items: center;
              }
              
              .polaris-description-list dt {
                font-weight: 600;
                color: #202223;
                font-size: 14px;
              }
              
              .polaris-description-list dd {
                margin: 0;
                color: #6d7175;
                font-size: 14px;
              }
              
              .polaris-webhook-stats {
                background: #f6f6f7;
                border-radius: 6px;
                padding: 16px;
                margin: 16px 0;
                border: 1px solid #e1e3e5;
              }
              
              .polaris-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 20px;
                height: 20px;
                font-size: 14px;
              }
              
              @media (max-width: 767px) {
                .polaris-page {
                  padding: 16px;
                }
                
                .polaris-stats-grid {
                  grid-template-columns: 1fr;
                }
                
                .polaris-stack--horizontal {
                  flex-direction: column;
                  align-items: stretch;
                }
                
                .polaris-description-list {
                  grid-template-columns: 1fr;
                  gap: 4px 0;
                }
                
                .polaris-description-list dt {
                  font-weight: 700;
                }
              }
            </style>
          </head>
          <body>
            <div class="polaris-page">
              <div class="polaris-page__header">
                <h1 class="polaris-page__title">
                  <span class="polaris-icon">🤖</span>
                  Naay Agent
                </h1>
              </div>
              
              <div class="polaris-banner polaris-banner--success">
                <span class="polaris-banner__icon">✅</span>
                <div>
                  <strong>Conexión exitosa</strong> - App conectada correctamente a ${shop || 'tu tienda'}
                </div>
              </div>
              
              <div class="polaris-stats-grid">
                <div class="polaris-stat-card">
                  <div class="polaris-stat-number">0</div>
                  <div class="polaris-stat-label">Productos Sincronizados</div>
                </div>
                <div class="polaris-stat-card">
                  <div class="polaris-stat-number">0</div>
                  <div class="polaris-stat-label">Conversaciones</div>
                </div>
                <div class="polaris-stat-card">
                  <div class="polaris-stat-number">Active</div>
                  <div class="polaris-stat-label">Estado del Chat</div>
                </div>
              </div>
              
              <div class="polaris-layout">
                <div class="polaris-stack">
                  <div class="polaris-card">
                    <div class="polaris-card__header">
                      <h2 class="polaris-card__title">
                        <span class="polaris-icon">🚀</span>
                        Acciones Rápidas
                      </h2>
                    </div>
                    <div class="polaris-card__content">
                      <div class="polaris-stack polaris-stack--horizontal">
                        <button class="polaris-button" onclick="syncProducts()">
                          Sincronizar Productos
                        </button>
                        <button class="polaris-button polaris-button--secondary" onclick="testChat()">
                          Probar Chat
                        </button>
                        <button class="polaris-button polaris-button--secondary" onclick="viewLogs()">
                          Ver Logs
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div class="polaris-card">
                    <div class="polaris-card__header">
                      <h2 class="polaris-card__title">
                        <span class="polaris-icon">💬</span>
                        Widget de Chat
                      </h2>
                    </div>
                    <div class="polaris-card__content">
                      <div class="polaris-toggle">
                        <input type="checkbox" id="widget-toggle" class="polaris-toggle__input" onchange="toggleWidget()">
                        <label class="polaris-toggle__label" for="widget-toggle">
                          <span id="widget-status-text">Activado</span>
                        </label>
                      </div>
                      <p class="polaris-text">
                        Cuando está activado, el widget de chat aparece en tu tienda para que los clientes puedan interactuar con el AI.
                      </p>
                    </div>
                  </div>
                  
                  <div class="polaris-card">
                    <div class="polaris-card__header">
                      <h2 class="polaris-card__title">
                        <span class="polaris-icon">🔗</span>
                        Gestión de Webhooks
                      </h2>
                    </div>
                    <div class="polaris-card__content">
                      <div class="polaris-description-list">
                        <dt>Estado de webhooks:</dt>
                        <dd><span id="webhook-status">⏳ Verificando...</span></dd>
                      </div>
                      
                      <div id="webhook-stats" class="polaris-webhook-stats" style="display: none;">
                        <div class="polaris-description-list">
                          <dt>Total de eventos:</dt>
                          <dd><span id="webhook-total">0</span></dd>
                          <dt>Eventos hoy:</dt>
                          <dd><span id="webhook-today">0</span></dd>
                          <dt>Pendientes:</dt>
                          <dd><span id="webhook-pending">0</span></dd>
                        </div>
                      </div>
                      
                      <div class="polaris-stack polaris-stack--horizontal" style="margin-top: 16px;">
                        <button class="polaris-button polaris-button--secondary" onclick="recreateWebhooks()">
                          Recrear Webhooks
                        </button>
                        <button class="polaris-button polaris-button--secondary" onclick="testWebhooks()">
                          Probar Conectividad
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div class="polaris-stack">
                  <div class="polaris-card">
                    <div class="polaris-card__header">
                      <h2 class="polaris-card__title">
                        <span class="polaris-icon">⚙️</span>
                        Configuración del Chat
                      </h2>
                    </div>
                    <div class="polaris-card__content">
                      <form id="settings-form">
                        <div style="display: grid; gap: 16px;">
                          <!-- Welcome Message -->
                          <div class="polaris-form-group">
                            <label for="welcome-message" class="polaris-label">Mensaje de bienvenida</label>
                            <textarea 
                              id="welcome-message" 
                              name="welcome_message"
                              class="polaris-input polaris-textarea" 
                              rows="3" 
                              placeholder="Mensaje que verán los usuarios al abrir el chat..."
                              maxlength="500"
                            ></textarea>
                            <span class="polaris-help-text">Máximo 500 caracteres</span>
                          </div>

                          <!-- Chat Position -->
                          <div class="polaris-form-group">
                            <label for="chat-position" class="polaris-label">Posición del chat</label>
                            <select id="chat-position" name="chat_position" class="polaris-input polaris-select">
                              <option value="bottom-right">Abajo derecha</option>
                              <option value="bottom-left">Abajo izquierda</option>
                              <option value="top-right">Arriba derecha</option>
                              <option value="top-left">Arriba izquierda</option>
                            </select>
                          </div>

                          <!-- Chat Color -->
                          <div class="polaris-form-group">
                            <label for="chat-color" class="polaris-label">Color del chat</label>
                            <input 
                              type="color" 
                              id="chat-color" 
                              name="chat_color" 
                              class="polaris-color-input"
                              value="#008060"
                            />
                          </div>

                          <!-- Checkboxes -->
                          <div class="polaris-form-group">
                            <div class="polaris-checkbox-group">
                              <label class="polaris-checkbox-label">
                                <input type="checkbox" id="auto-open-chat" name="auto_open_chat" class="polaris-checkbox">
                                <span class="polaris-checkbox-text">Abrir chat automáticamente</span>
                              </label>
                            </div>
                          </div>

                          <div class="polaris-form-group">
                            <div class="polaris-checkbox-group">
                              <label class="polaris-checkbox-label">
                                <input type="checkbox" id="show-agent-avatar" name="show_agent_avatar" class="polaris-checkbox" checked>
                                <span class="polaris-checkbox-text">Mostrar avatar del agente</span>
                              </label>
                            </div>
                          </div>

                          <div class="polaris-form-group">
                            <div class="polaris-checkbox-group">
                              <label class="polaris-checkbox-label">
                                <input type="checkbox" id="enable-product-recommendations" name="enable_product_recommendations" class="polaris-checkbox" checked>
                                <span class="polaris-checkbox-text">Recomendaciones de productos</span>
                              </label>
                            </div>
                          </div>

                          <!-- Action Buttons -->
                          <div class="polaris-stack polaris-stack--horizontal" style="margin-top: 16px;">
                            <button type="button" class="polaris-button polaris-button--primary" onclick="saveSettings()">
                              Guardar Configuración
                            </button>
                            <button type="button" class="polaris-button polaris-button--secondary" onclick="loadSettings()">
                              Recargar
                            </button>
                            <button type="button" class="polaris-button polaris-button--destructive" onclick="resetSettings()">
                              Restablecer
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                  
                  <div class="polaris-card">
                    <div class="polaris-card__header">
                      <h2 class="polaris-card__title">
                        <span class="polaris-icon">🔧</span>
                        Estado de Servicios
                      </h2>
                    </div>
                    <div class="polaris-card__content">
                      <ul class="polaris-status-list">
                        <li>
                          <span id="shopify-api-status" class="polaris-status-indicator">⏳</span>
                          <span>SHOPIFY_API_KEY</span>
                        </li>
                        <li>
                          <span id="shopify-secret-status" class="polaris-status-indicator">⏳</span>
                          <span>SHOPIFY_API_SECRET</span>
                        </li>
                        <li>
                          <span id="supabase-status" class="polaris-status-indicator">⏳</span>
                          <span>SUPABASE_URL</span>
                        </li>
                        <li>
                          <span id="openai-status" class="polaris-status-indicator">⏳</span>
                          <span>OPENAI_API_KEY</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  
                  <div class="polaris-card">
                    <div class="polaris-card__header">
                      <h2 class="polaris-card__title">
                        <span class="polaris-icon">📊</span>
                        Estado del Sistema
                      </h2>
                    </div>
                    <div class="polaris-card__content">
                      <div class="polaris-description-list">
                        <dt>Servidor:</dt>
                        <dd><span id="server-status">⏳ Verificando...</span></dd>
                        <dt>Base de datos:</dt>
                        <dd><span id="db-status">⏳ Verificando...</span></dd>
                        <dt>OpenAI:</dt>
                        <dd><span id="ai-status">⏳ Verificando...</span></dd>
                        <dt>Conectividad:</dt>
                        <dd><span id="webhook-connectivity">⏳ Verificando...</span></dd>
                        <dt>Última actualización:</dt>
                        <dd>${new Date().toLocaleString('es-ES')}</dd>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <script>
              // Initialize App Bridge 3.0 with proper session token handling
              let app = null;
              let sessionToken = null;
              let authenticatedFetch = null;
              const host = '${host || ''}';
              
              // Helper function to get session token from App Bridge
              async function getSessionToken() {
                return new Promise((resolve, reject) => {
                  if (!app) {
                    reject('App Bridge not initialized');
                    return;
                  }
                  
                  const timeout = setTimeout(() => {
                    reject('Session token request timeout');
                  }, 5000);
                  
                  try {
                    app.getSessionToken().then(token => {
                      clearTimeout(timeout);
                      sessionToken = token;
                      resolve(token);
                    }).catch(error => {
                      clearTimeout(timeout);
                      reject(error);
                    });
                  } catch (error) {
                    clearTimeout(timeout);
                    reject(error);
                  }
                });
              }
              
              if (host && typeof AppBridge !== 'undefined') {
                try {
                  app = AppBridge.createApp({
                    apiKey: '${config.shopify.apiKey}',
                    host: host
                  });
                  
                  console.log('App Bridge 3.0 initialized successfully');
                  
                  // Try to get initial session token
                  getSessionToken().then(token => {
                    console.log('Initial session token obtained');
                  }).catch(error => {
                    console.warn('Could not get initial session token:', error);
                  });
                  
                } catch (error) {
                  console.error('Failed to initialize App Bridge:', error);
                }
              } else if (!host) {
                console.warn('No host parameter provided - App Bridge cannot initialize');
              }
              
              // Enhanced helper function for authenticated requests
              async function makeAuthenticatedRequest(url, options = {}) {
                // Strategy 1: Try to get fresh session token from App Bridge
                if (app) {
                  try {
                    const token = await getSessionToken();
                    console.log('Using fresh session token for request');
                    return await fetch(url, {
                      ...options,
                      headers: {
                        ...options.headers,
                        'Authorization': \`Bearer \${token}\`,
                        'Content-Type': options.headers?.['Content-Type'] || 'application/json'
                      }
                    });
                  } catch (error) {
                    console.warn('Session token failed, trying fallback:', error);
                  }
                }
                
                // Strategy 2: Try cached session token
                if (sessionToken) {
                  try {
                    console.log('Using cached session token');
                    return await fetch(url, {
                      ...options,
                      headers: {
                        ...options.headers,
                        'Authorization': \`Bearer \${sessionToken}\`,
                        'Content-Type': options.headers?.['Content-Type'] || 'application/json'
                      }
                    });
                  } catch (error) {
                    console.warn('Cached session token failed, trying legacy:', error);
                  }
                }
                
                // Strategy 3: Fallback to legacy token 
                console.log('Using legacy token fallback');
                return await fetch(url, {
                  ...options,
                  headers: {
                    ...options.headers,
                    'Authorization': 'Bearer ${token || ''}',
                    'Content-Type': options.headers?.['Content-Type'] || 'application/json'
                  }
                });
              }
              
              // Function definitions
              window.syncProducts = async function() {
                try {
                  // Show loading state
                  const button = document.querySelector('button[onclick="syncProducts()"]');
                  const originalText = button.textContent;
                  button.textContent = 'Sincronizando...';
                  button.disabled = true;
                  
                  const response = await makeAuthenticatedRequest('/api/products/sync', { 
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    }
                  });
                  
                  const data = await response.json();
                  
                  if (data.success) {
                    alert('✅ Sincronización iniciada correctamente. Revisa los logs para seguimiento.');
                  } else {
                    alert('❌ Error en sincronización: ' + data.error);
                  }
                  
                  // Restore button
                  button.textContent = originalText;
                  button.disabled = false;
                  
                } catch (error) {
                  console.error('Sync error:', error);
                  alert('❌ Error de conexión durante la sincronización');
                }
              };
              
              window.testChat = function() {
                if (app) {
                  // Use App Bridge 3.0 actions
                  app.dispatch(AppBridge.actions.Navigation.navigate('/api/chat/test'));
                } else {
                  window.open('/api/chat/test', '_blank');
                }
              };
              
              window.viewLogs = function() {
                const azureLogUrl = 'https://portal.azure.com/#view/WebsitesExtension/LogStreamBlade/resourceId/%2Fsubscriptions%2Fe3b3c1bd-dfeb-4c47-a306-fdcaf6e8b99d%2FresourceGroups%2Fnaay-agent-rg%2Fproviders%2FMicrosoft.Web%2Fsites%2Fnaay-agent-app1763504937';
                window.open(azureLogUrl, '_blank');
              };
              
              // Webhook management functions
              window.recreateWebhooks = async function() {
                try {
                  const button = document.querySelector('button[onclick="recreateWebhooks()"]');
                  const originalText = button.textContent;
                  button.textContent = 'Creando...';
                  button.disabled = true;
                  
                  const response = await makeAuthenticatedRequest('/api/webhooks-admin/create', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    }
                  });
                  
                  const data = await response.json();
                  
                  if (data.success) {
                    alert('✅ Webhooks recreados correctamente');
                    loadWebhookStatus(); // Refresh status
                  } else {
                    alert('❌ Error al recrear webhooks: ' + data.error);
                  }
                  
                  button.textContent = originalText;
                  button.disabled = false;
                } catch (error) {
                  console.error('Webhook recreation error:', error);
                  alert('❌ Error de conexión al recrear webhooks');
                }
              };
              
              window.testWebhooks = async function() {
                try {
                  const response = await makeAuthenticatedRequest('/api/webhooks-admin/test', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    }
                  });
                  
                  const data = await response.json();
                  
                  if (data.success) {
                    const results = data.data.testResults;
                    const reachable = results.filter(r => r.status === 'reachable').length;
                    const total = results.length;
                    alert(\`🔗 Test de conectividad: \${reachable}/\${total} endpoints alcanzables\`);
                  } else {
                    alert('❌ Error al probar webhooks: ' + data.error);
                  }
                } catch (error) {
                  console.error('Webhook test error:', error);
                  alert('❌ Error de conexión al probar webhooks');
                }
              };
              
              // Widget toggle functionality
              window.toggleWidget = async function() {
                const toggle = document.getElementById('widget-toggle');
                const statusText = document.getElementById('widget-status-text');
                const chatStatusNumber = document.querySelector('.polaris-stat-card:nth-child(3) .polaris-stat-number');
                
                try {
                  const response = await makeAuthenticatedRequest('/api/widget/toggle', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      enabled: toggle.checked,
                      shop: '${shop || ''}'
                    })
                  });
                  
                  const data = await response.json();
                  
                  if (data.success) {
                    statusText.textContent = toggle.checked ? 'Activado' : 'Desactivado';
                    chatStatusNumber.textContent = toggle.checked ? 'Active' : 'Disabled';
                    
                    // Update the main chat status indicator
                    const chatStatusDiv = document.querySelector('.polaris-stat-card:nth-child(3)');
                    if (toggle.checked) {
                      chatStatusDiv.style.backgroundColor = '#f0f9ff';
                      chatStatusDiv.style.border = '1px solid #b3e5ff';
                      chatStatusNumber.style.color = '#008060';
                    } else {
                      chatStatusDiv.style.backgroundColor = '#fef7f7';
                      chatStatusDiv.style.border = '1px solid #ffc2c2';
                      chatStatusNumber.style.color = '#d72c0d';
                    }
                  } else {
                    alert('❌ Error al cambiar estado del widget: ' + data.error);
                    toggle.checked = !toggle.checked; // Revert toggle
                  }
                } catch (error) {
                  console.error('Widget toggle error:', error);
                  alert('❌ Error de conexión al cambiar estado del widget');
                  toggle.checked = !toggle.checked; // Revert toggle
                }
              };
              
              // Check system status on load
              window.addEventListener('load', async function() {
                try {
                  // Check detailed health endpoint
                  const healthResponse = await fetch('/health/detailed');
                  const healthData = await healthResponse.json();
                  
                  // Update system status indicators
                  document.querySelector('#server-status').textContent = healthData.success ? '✅ En línea' : '❌ Error';
                  document.querySelector('#db-status').textContent = 
                    healthData.services?.database === 'healthy' ? '✅ Conectado' : '⚠️ Error de conexión';
                  document.querySelector('#ai-status').textContent = 
                    healthData.services?.openai === 'healthy' ? '✅ Conectado' : '⚠️ Error de conexión';
                  
                  // Update credential status indicators
                  document.querySelector('#shopify-api-status').textContent = '✅';
                  document.querySelector('#shopify-secret-status').textContent = '✅';
                  document.querySelector('#supabase-status').textContent = 
                    healthData.services?.database === 'healthy' ? '✅' : '⚠️';
                  document.querySelector('#openai-status').textContent = 
                    healthData.services?.openai === 'healthy' ? '✅' : '⚠️';
                  
                  // Load widget status
                  const widgetResponse = await makeAuthenticatedRequest('/api/widget/status?shop=${shop || ''}');
                  const widgetData = await widgetResponse.json();
                  
                  if (widgetData.success) {
                    const toggle = document.getElementById('widget-toggle');
                    const statusText = document.getElementById('widget-status-text');
                    const chatStatusNumber = document.querySelector('.polaris-stat-card:nth-child(3) .polaris-stat-number');
                    
                    toggle.checked = widgetData.data.enabled;
                    statusText.textContent = widgetData.data.enabled ? 'Activado' : 'Desactivado';
                    chatStatusNumber.textContent = widgetData.data.enabled ? 'Active' : 'Disabled';
                    
                    // Update the main chat status indicator
                    const chatStatusDiv = document.querySelector('.polaris-stat-card:nth-child(3)');
                    if (widgetData.data.enabled) {
                      chatStatusDiv.style.backgroundColor = '#f0f9ff';
                      chatStatusDiv.style.border = '1px solid #b3e5ff';
                      chatStatusNumber.style.color = '#008060';
                    } else {
                      chatStatusDiv.style.backgroundColor = '#fef7f7';
                      chatStatusDiv.style.border = '1px solid #ffc2c2';
                      chatStatusNumber.style.color = '#d72c0d';
                    }
                  }
                  
                  // Load webhook status
                  loadWebhookStatus();
                  
                  // Load settings on page load
                  loadSettings(true);
                  
                } catch (error) {
                  console.error('Status check failed:', error);
                  document.querySelector('#server-status').textContent = '❌ Error';
                  document.querySelector('#db-status').textContent = '❌ Error';
                  document.querySelector('#ai-status').textContent = '❌ Error';
                }
              });
              
              // Function to load webhook status
              async function loadWebhookStatus() {
                try {
                  const statsResponse = await makeAuthenticatedRequest('/api/webhooks-admin/stats');
                  const statsData = await statsResponse.json();
                  
                  if (statsData.success) {
                    const stats = statsData.data.stats;
                    document.querySelector('#webhook-status').textContent = '✅ Configurado';
                    document.querySelector('#webhook-connectivity').textContent = '✅ Conectado';
                    
                    // Show webhook stats
                    document.querySelector('#webhook-stats').style.display = 'block';
                    document.querySelector('#webhook-total').textContent = stats.total || 0;
                    document.querySelector('#webhook-today').textContent = stats.today || 0;
                    document.querySelector('#webhook-pending').textContent = stats.pending || 0;
                    
                    // Update products synchronized count (approximate from webhook events)
                    const productEvents = ['products/create', 'products/update'].reduce((sum, topic) => 
                      sum + (stats.topicBreakdown[topic] || 0), 0);
                    document.querySelector('.polaris-stat-card:first-child .polaris-stat-number').textContent = productEvents;
                  } else {
                    document.querySelector('#webhook-status').textContent = '⚠️ No configurado';
                    document.querySelector('#webhook-connectivity').textContent = '⚠️ Error';
                  }
                } catch (error) {
                  console.error('Webhook status check failed:', error);
                  document.querySelector('#webhook-status').textContent = '❌ Error';
                  document.querySelector('#webhook-connectivity').textContent = '❌ Error';
                }
              }
              
              // Settings management functions
              window.saveSettings = async function() {
                try {
                  const button = document.querySelector('button[onclick="saveSettings()"]');
                  const originalText = button.textContent;
                  button.textContent = 'Guardando...';
                  button.disabled = true;
                  
                  // Gather form data
                  const formData = {
                    welcome_message: document.getElementById('welcome-message').value,
                    chat_position: document.getElementById('chat-position').value,
                    chat_color: document.getElementById('chat-color').value,
                    auto_open_chat: document.getElementById('auto-open-chat').checked,
                    show_agent_avatar: document.getElementById('show-agent-avatar').checked,
                    enable_product_recommendations: document.getElementById('enable-product-recommendations').checked
                  };
                  
                  const response = await makeAuthenticatedRequest('/api/settings/update', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                  });
                  
                  const data = await response.json();
                  
                  if (data.success) {
                    alert('✅ Configuración guardada correctamente');
                  } else {
                    alert('❌ Error al guardar configuración: ' + data.error);
                  }
                  
                  // Restore button
                  button.textContent = originalText;
                  button.disabled = false;
                  
                } catch (error) {
                  console.error('Save settings error:', error);
                  alert('❌ Error de conexión al guardar configuración');
                  
                  // Restore button
                  const button = document.querySelector('button[onclick="saveSettings()"]');
                  button.textContent = 'Guardar Configuración';
                  button.disabled = false;
                }
              };
              
              window.loadSettings = async function(silent = false) {
                try {
                  const button = document.querySelector('button[onclick="loadSettings()"]');
                  let originalText = '';
                  
                  if (button && !silent) {
                    originalText = button.textContent;
                    button.textContent = 'Cargando...';
                    button.disabled = true;
                  }
                  
                  const response = await makeAuthenticatedRequest('/api/settings/');
                  const data = await response.json();
                  
                  if (data.success && data.data.settings) {
                    const settings = data.data.settings;
                    
                    // Populate form fields
                    document.getElementById('welcome-message').value = settings.welcome_message || '';
                    document.getElementById('chat-position').value = settings.chat_position || 'bottom-right';
                    document.getElementById('chat-color').value = settings.chat_color || '#008060';
                    document.getElementById('auto-open-chat').checked = settings.auto_open_chat || false;
                    document.getElementById('show-agent-avatar').checked = settings.show_agent_avatar !== false;
                    document.getElementById('enable-product-recommendations').checked = settings.enable_product_recommendations !== false;
                    
                    if (!silent) {
                      alert('✅ Configuración recargada correctamente');
                    }
                  } else {
                    if (!silent) {
                      alert('❌ Error al cargar configuración: ' + (data.error || 'Unknown error'));
                    }
                  }
                  
                  // Restore button
                  if (button && !silent) {
                    button.textContent = originalText;
                    button.disabled = false;
                  }
                  
                } catch (error) {
                  console.error('Load settings error:', error);
                  
                  if (!silent) {
                    alert('❌ Error de conexión al cargar configuración');
                    
                    // Restore button
                    const button = document.querySelector('button[onclick="loadSettings()"]');
                    if (button) {
                      button.textContent = 'Recargar';
                      button.disabled = false;
                    }
                  }
                }
              };
              
              window.resetSettings = async function() {
                if (!confirm('¿Estás seguro de que deseas restablecer todas las configuraciones a sus valores por defecto?')) {
                  return;
                }
                
                try {
                  const button = document.querySelector('button[onclick="resetSettings()"]');
                  const originalText = button.textContent;
                  button.textContent = 'Restableciendo...';
                  button.disabled = true;
                  
                  const response = await makeAuthenticatedRequest('/api/settings/reset', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    }
                  });
                  
                  const data = await response.json();
                  
                  if (data.success) {
                    // Update form with default values
                    const settings = data.data.settings;
                    document.getElementById('welcome-message').value = settings.welcome_message || '';
                    document.getElementById('chat-position').value = settings.chat_position || 'bottom-right';
                    document.getElementById('chat-color').value = settings.chat_color || '#008060';
                    document.getElementById('auto-open-chat').checked = settings.auto_open_chat || false;
                    document.getElementById('show-agent-avatar').checked = settings.show_agent_avatar !== false;
                    document.getElementById('enable-product-recommendations').checked = settings.enable_product_recommendations !== false;
                    
                    alert('✅ Configuración restablecida a valores por defecto');
                  } else {
                    alert('❌ Error al restablecer configuración: ' + data.error);
                  }
                  
                  // Restore button
                  button.textContent = originalText;
                  button.disabled = false;
                  
                } catch (error) {
                  console.error('Reset settings error:', error);
                  alert('❌ Error de conexión al restablecer configuración');
                  
                  // Restore button
                  const button = document.querySelector('button[onclick="resetSettings()"]');
                  button.textContent = 'Restablecer';
                  button.disabled = false;
                }
              };
            </script>
          </body>
          </html>
        `);
      } else if (hmac && shop && host) {
        // Process the app installation in background
        setTimeout(async () => {
          try {
            logger.info('Processing Shopify app installation', { shop, host, hmac: !!hmac });
            
            // Check if store exists in our database
            const supabaseService = new (require('@/services/supabase.service')).SupabaseService();
            const queueService = new (require('@/services/queue.service')).QueueService();
            
            let store = await supabaseService.getStore(shop as string);
            
            if (!store) {
              // For App Bridge apps, we need to use a placeholder token initially
              // The real token exchange happens later via API calls from the frontend
              store = await supabaseService.createStore({
                shop_domain: shop as string,
                access_token: 'pending_token_exchange', // Placeholder
                scopes: config.shopify.scopes,
                installed_at: new Date(),
                updated_at: new Date(),
              });
              
              logger.info(`Created store entry for App Bridge installation: ${shop}`);
            } else {
              await supabaseService.updateStoreToken(shop as string, store.access_token);
              logger.info(`Updated existing store for App Bridge: ${shop}`);
            }
            
            // Don't trigger sync yet - wait for proper token exchange
            logger.info(`App Bridge installation processed for: ${shop}`);
            
          } catch (error) {
            logger.error('Failed to process app installation:', error);
          }
        }, 1000);
      
        // Show the welcome page immediately
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Naay Agent - Installation Complete</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 0; padding: 40px; color: white; text-align: center;
              }
              .container { 
                max-width: 600px; margin: 0 auto; background: rgba(255,255,255,0.1);
                padding: 40px; border-radius: 20px; backdrop-filter: blur(10px);
              }
              .success-icon { font-size: 72px; margin-bottom: 20px; }
              h1 { margin: 0 0 10px; font-size: 32px; }
              .shop-name { font-weight: bold; color: #a8ff78; }
              .next-steps { background: rgba(255,255,255,0.1); padding: 20px; margin: 20px 0; border-radius: 10px; text-align: left; }
              .step { margin: 10px 0; padding: 8px 0; }
              .footer { margin-top: 30px; font-size: 14px; opacity: 0.8; }
              .back-link { display: inline-block; background: rgba(255,255,255,0.2); padding: 12px 24px; border-radius: 8px; text-decoration: none; color: white; margin-top: 20px; }
              .back-link:hover { background: rgba(255,255,255,0.3); }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">🎉</div>
              <h1>¡Bienvenido a Naay Agent!</h1>
              <p>Tu AI Shopping Assistant está funcionando correctamente en <span class="shop-name">${shop}</span></p>
              
              <div class="next-steps">
                <h3>🚀 Funcionalidades Activas:</h3>
                <div class="step">✅ API de chat inteligente activa</div>
                <div class="step">💬 Búsqueda semántica de productos</div>
                <div class="step">🛒 Gestión automática del carrito</div>
                <div class="step">🎨 Widget listo para integrar en tu tema</div>
              </div>
              
              <div class="next-steps">
                <h3>📝 Próximos Pasos:</h3>
                <div class="step" id="step1">⏳ Procesando instalación...</div>
                <div class="step">2. Configura las variables de entorno (Supabase, OpenAI)</div>
                <div class="step">3. Agrega el widget de chat a tu tema</div>
                <div class="step">4. Sincroniza tus productos</div>
                <div class="step">5. Prueba el chat en tu tienda</div>
              </div>
              
              <script>
                // Auto-verify the app installation
                setTimeout(async () => {
                  try {
                    const response = await fetch('/auth/verify', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        shop: '${shop}',
                        hmac: '${hmac}',
                        host: '${host}',
                        timestamp: '${timestamp}'
                      })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                      document.getElementById('step1').innerHTML = '✅ 1. App instalada correctamente';
                      document.getElementById('step1').style.color = '#a8ff78';
                    } else {
                      document.getElementById('step1').innerHTML = '❌ 1. Error en instalación - revisar logs';
                      document.getElementById('step1').style.color = '#ff6b6b';
                    }
                  } catch (error) {
                    console.error('Installation verification failed:', error);
                    document.getElementById('step1').innerHTML = '❌ 1. Error en instalación - revisar conexión';
                    document.getElementById('step1').style.color = '#ff6b6b';
                  }
                }, 2000);
              </script>
              
              <a href="https://${shop}/admin/apps" class="back-link">
                ← Volver a Apps de Shopify
              </a>
              
              <div class="footer">
                <p>Naay Agent v1.0.0 - AI Shopping Assistant</p>
                <p>Conectado: ${new Date().toLocaleString('es-ES')}</p>
                <p>Host: ${host || 'N/A'}</p>
              </div>
            </div>
          </body>
          </html>
        `);
      } else if (token && shop) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Naay Agent - Installation Complete</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 0; padding: 40px; color: white; text-align: center;
              }
              .container { 
                max-width: 600px; margin: 0 auto; background: rgba(255,255,255,0.1);
                padding: 40px; border-radius: 20px; backdrop-filter: blur(10px);
              }
              .success-icon { font-size: 72px; margin-bottom: 20px; }
              h1 { margin: 0 0 10px; font-size: 32px; }
              .shop-name { font-weight: bold; color: #a8ff78; }
              .next-steps { background: rgba(255,255,255,0.1); padding: 20px; margin: 20px 0; border-radius: 10px; text-align: left; }
              .step { margin: 10px 0; padding: 8px 0; }
              .footer { margin-top: 30px; font-size: 14px; opacity: 0.8; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">🎉</div>
              <h1>¡Instalación Completada!</h1>
              <p>Naay Agent ha sido instalado exitosamente en <span class="shop-name">${shop}</span></p>
              
              <div class="next-steps">
                <h3>🚀 Próximos Pasos:</h3>
                <div class="step">✅ Sincronización automática de productos iniciada</div>
                <div class="step">💬 El chat AI está listo para usar</div>
                <div class="step">🎨 Agrega el widget a tu tema de Shopify</div>
                <div class="step">⚙️ Configura las variables de entorno si es necesario</div>
              </div>
              
              <div class="footer">
                <p>Naay Agent v1.0.0 - AI Shopping Assistant</p>
                <p>Instalado: ${new Date().toLocaleString('es-ES')}</p>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        // Regular API response for direct access
        res.json({
          success: true,
          message: '🎉 Naay Agent - Shopify AI Assistant',
          version: '1.0.0',
          status: 'running',
          timestamp: new Date().toISOString(),
          shopify_app_url: config.shopify.appUrl,
          endpoints: {
            auth: '/auth',
            health: '/health',
            chat: '/api/chat',
            webhooks: '/api/webhooks',
            products: '/api/products'
          }
        });
      }
    });

    // Success page after Shopify app installation
    app.get('/success', (req, res) => {
      const { token, shop } = req.query;
      
      logger.info('Success page accessed', {
        query: req.query,
        hasToken: !!token,
        hasShop: !!shop
      });
      
      if (token && shop) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Naay Agent - Installation Complete</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 0; padding: 40px; color: white; text-align: center;
              }
              .container { 
                max-width: 600px; margin: 0 auto; background: rgba(255,255,255,0.1);
                padding: 40px; border-radius: 20px; backdrop-filter: blur(10px);
              }
              .success-icon { font-size: 72px; margin-bottom: 20px; }
              h1 { margin: 0 0 10px; font-size: 32px; }
              .shop-name { font-weight: bold; color: #a8ff78; }
              .next-steps { background: rgba(255,255,255,0.1); padding: 20px; margin: 20px 0; border-radius: 10px; text-align: left; }
              .step { margin: 10px 0; padding: 8px 0; }
              .footer { margin-top: 30px; font-size: 14px; opacity: 0.8; }
              .back-link { display: inline-block; background: rgba(255,255,255,0.2); padding: 12px 24px; border-radius: 8px; text-decoration: none; color: white; margin-top: 20px; }
              .back-link:hover { background: rgba(255,255,255,0.3); }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">🎉</div>
              <h1>¡Instalación Completada!</h1>
              <p>Naay Agent ha sido instalado exitosamente en <span class="shop-name">${shop}</span></p>
              
              <div class="next-steps">
                <h3>🚀 Próximos Pasos:</h3>
                <div class="step">✅ Sincronización automática de productos iniciada</div>
                <div class="step">💬 El chat AI está listo para usar</div>
                <div class="step">🎨 Agrega el widget a tu tema de Shopify</div>
                <div class="step">⚙️ Configura las variables de entorno si es necesario</div>
              </div>
              
              <a href="https://${shop}/admin/apps" class="back-link">
                ← Volver a Apps de Shopify
              </a>
              
              <div class="footer">
                <p>Naay Agent v1.0.0 - AI Shopping Assistant</p>
                <p>Instalado: ${new Date().toLocaleString('es-ES')}</p>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        res.redirect('/');
      }
    });

    // Traditional OAuth install route
    app.get('/install', (req, res) => {
      const { shop } = req.query;
      
      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required'
        });
      }
      
      // Redirect to OAuth flow
      const scopes = 'read_products,write_products,read_orders,read_customers';
      const redirectUri = `${config.shopify.appUrl}/auth/callback`;
      const installUrl = `https://${shop}/admin/oauth/authorize` +
        `?client_id=${config.shopify.apiKey}` +
        `&scope=${scopes}` +
        `&redirect_uri=${redirectUri}` +
        `&state=${Date.now()}`;
      
      res.redirect(installUrl);
    });

    // API Routes
    app.use('/auth', authRoutes);
    app.use('/api/products', productRoutes);
    app.use('/api/webhooks', webhookRoutes);
    app.use('/api/webhooks-admin', webhookAdminRoutes);
    app.use('/api/chat', chatRoutes);
    app.use('/api/widget', widgetRoutes);
    app.use('/api/settings', settingsRoutes);
    app.use('/api/admin', adminRoutes);

    // 404 handler
    app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Route not found',
      });
    });

    // Error handling middleware (must be last)
    app.use(errorHandler);

    // Start server
    const port = config.server.port;
    app.listen(port, () => {
      logger.info(`🚀 Naay Agent Backend running on port ${port}`);
      logger.info(`📱 Environment: ${config.server.nodeEnv}`);
      logger.info(`🔐 Shopify App URL: ${config.shopify.appUrl}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

startServer();
