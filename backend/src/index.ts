import express from 'express';
import cors from 'cors';
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
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0; padding: 20px; background: #f7f7f7; color: #333;
              }
              .container { 
                max-width: 1200px; margin: 0 auto; background: white;
                padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              h1 { color: #5c6ac4; margin: 0 0 20px; }
              .stats { display: flex; gap: 20px; margin: 20px 0; }
              .stat { background: #f9f9f9; padding: 20px; border-radius: 8px; flex: 1; text-align: center; }
              .stat-number { font-size: 32px; font-weight: bold; color: #5c6ac4; }
              .stat-label { font-size: 14px; color: #666; margin-top: 5px; }
              .section { margin: 30px 0; }
              .button { 
                background: #5c6ac4; color: white; padding: 12px 24px; 
                border: none; border-radius: 4px; cursor: pointer; margin: 10px;
              }
              .button:hover { background: #4c5aa0; }
              .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
              .status.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
              .status.warning { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>🤖 Naay Agent - Panel de Administración</h1>
              
              <div class="status success">
                ✅ App conectada correctamente a ${shop || 'tu tienda'}
              </div>
              
              <div class="stats">
                <div class="stat">
                  <div class="stat-number">0</div>
                  <div class="stat-label">Productos Sincronizados</div>
                </div>
                <div class="stat">
                  <div class="stat-number">0</div>
                  <div class="stat-label">Conversaciones</div>
                </div>
                <div class="stat">
                  <div class="stat-number">Active</div>
                  <div class="stat-label">Estado del Chat</div>
                </div>
              </div>
              
              <div class="section">
                <h2>🚀 Acciones Rápidas</h2>
                <button class="button" onclick="syncProducts()">Sincronizar Productos</button>
                <button class="button" onclick="testChat()">Probar Chat</button>
                <button class="button" onclick="viewLogs()">Ver Logs</button>
              </div>
              
              <div class="section">
                <h2>💬 Widget de Chat</h2>
                <div style="display: flex; align-items: center; gap: 15px; margin: 15px 0;">
                  <span>Estado del Widget:</span>
                  <label style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="widget-toggle" onchange="toggleWidget()" style="transform: scale(1.5);">
                    <span id="widget-status-text">Activado</span>
                  </label>
                </div>
                <p style="color: #666; font-size: 14px;">
                  Cuando está activado, el widget de chat aparece en tu tienda para que los clientes puedan interactuar con el AI.
                </p>
              </div>
              
              <div class="section">
                <h2>⚙️ Configuración</h2>
                <div class="status warning">
                  ⚠️ Completa la configuración de variables de entorno (Supabase, OpenAI)
                </div>
                <p>Para activar todas las funcionalidades del chat AI, configura las siguientes variables:</p>
                <ul>
                  <li><span id="shopify-api-status">⏳ Verificando...</span> SHOPIFY_API_KEY</li>
                  <li><span id="shopify-secret-status">⏳ Verificando...</span> SHOPIFY_API_SECRET</li>
                  <li><span id="supabase-status">⏳ Verificando...</span> SUPABASE_URL</li>
                  <li><span id="openai-status">⏳ Verificando...</span> OPENAI_API_KEY</li>
                </ul>
              </div>
              
              <div class="section">
                <h2>🔗 Webhooks</h2>
                <div style="margin: 15px 0;">
                  <p><strong>Estado de webhooks:</strong> <span id="webhook-status">⏳ Verificando...</span></p>
                  <div id="webhook-stats" style="display: none; margin: 10px 0; padding: 10px; background: #f9f9f9; border-radius: 4px;">
                    <p style="margin: 5px 0;"><strong>Total de eventos:</strong> <span id="webhook-total">0</span></p>
                    <p style="margin: 5px 0;"><strong>Eventos hoy:</strong> <span id="webhook-today">0</span></p>
                    <p style="margin: 5px 0;"><strong>Pendientes:</strong> <span id="webhook-pending">0</span></p>
                  </div>
                  <button class="button" onclick="recreateWebhooks()">Recrear Webhooks</button>
                  <button class="button" onclick="testWebhooks()">Probar Conectividad</button>
                </div>
              </div>
              
              <div class="section">
                <h2>📊 Estado del Sistema</h2>
                <p><strong>Servidor:</strong> <span id="server-status">⏳ Verificando...</span></p>
                <p><strong>Base de datos:</strong> <span id="db-status">⏳ Verificando conexión...</span></p>
                <p><strong>OpenAI:</strong> <span id="ai-status">⏳ Verificando conexión...</span></p>
                <p><strong>Webhooks:</strong> <span id="webhook-connectivity">⏳ Verificando...</span></p>
                <p><strong>Última actualización:</strong> ${new Date().toLocaleString('es-ES')}</p>
              </div>
            </div>
            
            <script>
              // Initialize App Bridge 3.0
              let app = null;
              const host = '${host || ''}';
              
              if (host && typeof AppBridge !== 'undefined') {
                try {
                  app = AppBridge.createApp({
                    apiKey: '${config.shopify.apiKey}',
                    host: host,
                    forceRedirect: true
                  });
                  console.log('App Bridge 3.0 initialized successfully');
                } catch (error) {
                  console.error('Failed to initialize App Bridge:', error);
                }
              } else if (!host) {
                console.warn('No host parameter provided - App Bridge cannot initialize');
              }
              
              // Function definitions
              window.syncProducts = async function() {
                try {
                  // Show loading state
                  const button = document.querySelector('button[onclick="syncProducts()"]');
                  const originalText = button.textContent;
                  button.textContent = 'Sincronizando...';
                  button.disabled = true;
                  
                  const response = await fetch('/api/products/sync', { 
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': 'Bearer ${token || ''}'
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
                  
                  const response = await fetch('/api/webhooks-admin/create', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': 'Bearer ${token || ''}'
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
                  const response = await fetch('/api/webhooks-admin/test', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': 'Bearer ${token || ''}'
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
                const chatStatusNumber = document.querySelector('.stat-number:last-child');
                
                try {
                  const response = await fetch('/api/widget/toggle', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': 'Bearer ${token || ''}'
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
                    const chatStatusDiv = document.querySelector('.stat:nth-child(3)');
                    if (toggle.checked) {
                      chatStatusDiv.style.backgroundColor = '#d4edda';
                      chatStatusDiv.style.color = '#155724';
                    } else {
                      chatStatusDiv.style.backgroundColor = '#f8d7da';
                      chatStatusDiv.style.color = '#721c24';
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
                  const widgetResponse = await fetch('/api/widget/status?shop=${shop || ''}');
                  const widgetData = await widgetResponse.json();
                  
                  if (widgetData.success) {
                    const toggle = document.getElementById('widget-toggle');
                    const statusText = document.getElementById('widget-status-text');
                    const chatStatusNumber = document.querySelector('.stat-number:last-child');
                    
                    toggle.checked = widgetData.data.enabled;
                    statusText.textContent = widgetData.data.enabled ? 'Activado' : 'Desactivado';
                    chatStatusNumber.textContent = widgetData.data.enabled ? 'Active' : 'Disabled';
                    
                    // Update the main chat status indicator
                    const chatStatusDiv = document.querySelector('.stat:nth-child(3)');
                    if (widgetData.data.enabled) {
                      chatStatusDiv.style.backgroundColor = '#d4edda';
                      chatStatusDiv.style.color = '#155724';
                    } else {
                      chatStatusDiv.style.backgroundColor = '#f8d7da';
                      chatStatusDiv.style.color = '#721c24';
                    }
                  }
                  
                  // Load webhook status
                  loadWebhookStatus();
                  
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
                  const statsResponse = await fetch('/api/webhooks-admin/stats', {
                    headers: {
                      'Authorization': 'Bearer ${token || ''}'
                    }
                  });
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
                    document.querySelector('.stat-number:first-child').textContent = productEvents;
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
