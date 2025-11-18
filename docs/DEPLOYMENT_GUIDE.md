# 🚀 Guía de Deployment - Naay Agent

Guía completa para desplegar Naay Agent en tu Shopify Dev Store y posteriormente en producción.

## 📋 Prerequisitos

### Cuentas y Servicios Requeridos

1. **Shopify Partner Account**
   - [Registro gratuito](https://partners.shopify.com/signup)
   - Necesario para crear apps de Shopify

2. **Shopify Development Store**
   - Crear desde Partner Dashboard
   - Habilitar "Development Store" settings

3. **Supabase Account**
   - [Registro gratuito](https://supabase.com/dashboard)
   - Crear nuevo proyecto

4. **OpenAI Account**
   - [Registro](https://platform.openai.com/signup)
   - API key con acceso a GPT-4 y embeddings

5. **Hosting para Backend** (opciones)
   - Railway, Fly.io, Vercel, Render
   - O servidor VPS/dedicado

## 🛠️ Setup Local para Desarrollo

### 1. Preparar el Entorno

```bash
# Clonar y configurar proyecto
git clone <your-repo>
cd naay-agent

# Ejecutar setup automático
./scripts/dev-setup.sh

# O manualmente:
npm install
cd backend && npm install && cd ..
cd frontend-widget && npm install && cd ..
```

### 2. Configurar Variables de Entorno

Edita `config/.env`:

```env
# Shopify Configuration
SHOPIFY_API_KEY=your_app_api_key
SHOPIFY_API_SECRET=your_app_secret_key
SHOPIFY_SCOPES=read_products,write_products,read_orders,read_customers,write_draft_orders
SHOPIFY_APP_URL=https://your-tunnel-url.ngrok.io
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret

# Supabase Configuration  
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4
EMBEDDING_MODEL=text-embedding-3-small

# Development
NODE_ENV=development
PORT=3000
REDIS_URL=redis://localhost:6379
```

### 3. Configurar Supabase

```bash
# Instalar Supabase CLI
npm install -g supabase

# Setup automático
./scripts/setup-supabase.sh

# O manual:
supabase start
supabase db push --local
```

### 4. Configurar Shopify App

1. **Crear App en Partner Dashboard:**
   - Ve a [Partner Dashboard](https://partners.shopify.com/dashboard)
   - Crea nueva app
   - Anota API Key y Secret Key

2. **Configurar shopify.app.toml:**
   ```toml
   name = "naay-agent"
   client_id = "your_api_key_here"
   application_url = "https://your-tunnel-url.ngrok.io"
   embedded = true
   
   [access_scopes]
   scopes = "read_products,write_products,read_orders,read_customers,write_draft_orders"
   ```

## 🔧 Testing en Dev Store

### 1. Iniciar Túnel de Desarrollo

```bash
# Opción 1: ngrok (recomendado)
ngrok http 3000

# Opción 2: Cloudflare Tunnel
cloudflared tunnel --url http://localhost:3000

# Opción 3: Shopify CLI (integrado)
shopify app dev
```

### 2. Iniciar Servicios

```bash
# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Widget (opcional para desarrollo)
npm run dev:widget

# Terminal 3: Shopify App
npm run dev:shopify
```

### 3. Instalar en Dev Store

1. El comando `shopify app dev` te dará una URL de instalación
2. Ve a tu development store
3. Instala la app usando la URL proporcionada
4. ✅ **La sincronización será automática** - el catálogo se descargará inmediatamente

### 4. Activar el Widget

1. Ve a **Online Store > Themes** en tu dev store
2. Personalizar tema actual
3. Agregar sección **"Naay AI Chat"**
4. Configurar:
   - API Endpoint: tu URL de túnel
   - Posición, colores, mensajes
5. Guardar y publicar

### 5. Testing del Chat

```bash
# Queries de prueba:
# "Muéstrame vestidos rojos bajo $100"
# "Necesito zapatos para correr"
# "¿Qué está en oferta?"
# "Agrega una camiseta azul a mi carrito"
# "¿Cuáles son sus políticas de devolución?"
```

## 🌐 Deployment a Producción

### 1. Preparar Backend para Producción

#### Opción A: Railway

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login y deploy
railway login
railway init
railway add

# Variables de entorno en Railway dashboard
# Deploy
railway deploy
```

#### Opción B: Fly.io

```bash
# Instalar flyctl
curl -L https://fly.io/install.sh | sh

# Setup
flyctl launch
flyctl deploy
```

#### Opción C: Vercel

```bash
npm install -g vercel
vercel
vercel --prod
```

### 2. Configurar Supabase Producción

1. **Crear proyecto de producción** en Supabase
2. **Ejecutar migraciones:**
   ```bash
   supabase db push --project-ref your-prod-project-ref
   ```
3. **Actualizar variables de entorno** con URLs de producción

### 3. Actualizar Configuración Shopify

1. **En Partner Dashboard:**
   - Actualizar App URL a tu dominio de producción
   - Actualizar Webhook URLs
   - Configurar Redirect URLs

2. **Actualizar shopify.app.toml:**
   ```toml
   application_url = "https://your-production-domain.com"
   
   [auth]
   redirect_urls = [
     "https://your-production-domain.com/auth/callback"
   ]
   
   [[webhooks.subscriptions]]
   uri = "https://your-production-domain.com/api/webhooks/products/create"
   ```

### 4. Build y Deploy del Widget

```bash
# Build optimizado
cd frontend-widget
npm run build

# Subir a CDN (ej: AWS S3, Cloudflare)
aws s3 sync dist/ s3://your-cdn-bucket/naay-widget/

# O usar GitHub Pages, Netlify, etc.
```

### 5. Deploy Theme Extension

```bash
# Deploy la extensión
shopify app deploy

# Configurar en tema de producción
# Actualizar URL del widget en la configuración
```

## ✅ Checklist de Deployment

### Pre-Deploy

- [ ] Variables de entorno configuradas correctamente
- [ ] Supabase proyecto creado y migraciones aplicadas
- [ ] OpenAI API key configurada con suficiente crédito
- [ ] Redis disponible (para production)
- [ ] Domain/hosting configurado con HTTPS
- [ ] Shopify app configurada en Partner Dashboard

### Deploy Backend

- [ ] Backend desplegado y accesible
- [ ] Health check (`/health`) responde correctamente
- [ ] Variables de entorno aplicadas
- [ ] Base de datos conectada
- [ ] Redis conectado (si se usa)

### Deploy Widget

- [ ] Widget compilado y subido a CDN
- [ ] URLs actualizadas en theme extension
- [ ] Testing en diferentes navegadores
- [ ] Responsive design verificado

### Deploy Shopify

- [ ] App instalada en tienda de prueba
- [ ] Webhooks funcionando
- [ ] Sincronización automática funcionando
- [ ] Theme extension activada
- [ ] Chat widget visible y funcional

### Post-Deploy

- [ ] Monitoring configurado
- [ ] Logs funcionando
- [ ] Analytics funcionando
- [ ] Backup de base de datos configurado
- [ ] SSL/TLS certificados válidos

## 🔍 Monitoreo y Debugging

### Logs Importantes

```bash
# Backend logs
tail -f logs/combined.log

# Supabase logs
supabase inspect db logs

# Widget errors (en browser)
console.log para debugging
```

### Health Checks

```bash
# Backend health
curl https://your-api.com/health

# Chat service health  
curl https://your-api.com/api/chat/health

# Database connection
curl https://your-api.com/health/detailed
```

### Métricas Clave

- Tiempo de respuesta del chat
- Tasa de éxito de sincronización
- Uso de tokens de OpenAI
- Errores en webhooks
- Conversiones asistidas por IA

## 🐛 Troubleshooting Común

### Widget no Aparece

1. Verificar que el script se carga correctamente
2. Check browser console por errores JavaScript
3. Verificar que la API responde
4. Confirmar configuración del theme extension

### Sincronización Falla

1. Verificar webhooks en Partner Dashboard
2. Check logs del backend para errores
3. Confirmar que Supabase está accesible
4. Verificar permisos de la app

### Chat no Responde

1. Verificar OpenAI API key y créditos
2. Check logs del agente IA
3. Verificar que Supabase tiene datos de productos
4. Confirmar embeddings generados correctamente

## 📚 Recursos Adicionales

- [Shopify App Development](https://shopify.dev/docs/apps)
- [Supabase Documentation](https://supabase.com/docs)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [Theme App Extensions](https://shopify.dev/docs/apps/online-store/theme-app-extensions)

## 🆘 Soporte

- **Issues**: Crear issue en el repositorio
- **Logs**: Incluir siempre logs relevantes
- **Environment**: Especificar si es dev/staging/production
- **Pasos**: Describir pasos para reproducir el problema