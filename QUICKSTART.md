# ⚡ Quick Start - Naay Agent Testing

**Credenciales Shopify ya integradas** ✅  
Solo necesitas completar Supabase y OpenAI.

## 🚀 Setup Rápido (10 minutos)

### 1. Instalar Dependencias
```bash
npm install
cd backend && npm install && cd ..
cd frontend-widget && npm install && cd ..
```

### 2. Completar Variables de Entorno

Edita `config/.env` y completa **solo estos campos**:

```env
# ✅ SHOPIFY YA CONFIGURADO
SHOPIFY_API_KEY=1c7a47abe69b8020f7ed37d3528e0552
SHOPIFY_API_SECRET=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

# ⚠️ COMPLETAR - URLs se actualizarán automáticamente
SHOPIFY_APP_URL=https://your-tunnel-url.ngrok.io

# ⚠️ COMPLETAR - Crear proyecto en supabase.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key  
SUPABASE_SERVICE_KEY=your_service_role_key

# ⚠️ COMPLETAR - API key de platform.openai.com
OPENAI_API_KEY=sk-your-openai-api-key
```

### 3. Setup Supabase
```bash
# Instalar CLI
npm install -g supabase

# Configurar base de datos
./scripts/setup-supabase.sh
```

### 4. Iniciar Development
```bash
# Terminal 1: Túnel público (requerido para Shopify)
npx ngrok http 3000

# Terminal 2: Backend
npm run dev:backend

# Terminal 3: Shopify App
npm run dev:shopify
```

### 5. Actualizar URL en .env
Cuando ngrok esté corriendo, copia la HTTPS URL y actualiza:
```env
SHOPIFY_APP_URL=https://abc123.ngrok.io
```

### 6. Instalar en Dev Store
- El comando `shopify app dev` te dará una URL de instalación
- Ve a tu development store y usa esa URL para instalar
- ✅ **Sincronización automática** del catálogo

### 7. Activar Widget
- **Themes > Customize**
- **Add section > Naay AI Chat**  
- **API Endpoint**: tu URL de ngrok
- **Guardar y publicar**

## 🧪 Testing Ready!

**Prueba estos comandos:**
- "Muéstrame vestidos rojos bajo $100"
- "Necesito zapatos para correr"
- "¿Qué está en oferta?" 
- "Agrega una camiseta azul a mi carrito"

## ⚙️ URLs que Necesitas

### Supabase
1. Ve a [supabase.com](https://supabase.com)
2. Crear nuevo proyecto
3. Copiar URL, anon key y service key

### OpenAI  
1. Ve a [platform.openai.com](https://platform.openai.com)
2. Crear API key
3. Asegurar créditos disponibles

### ngrok (para túnel público)
1. [ngrok.com](https://ngrok.com) - registro gratis
2. `ngrok config add-authtoken your_token`
3. `ngrok http 3000`

## 🎯 Todo Listo!

**Shopify credentials** ✅ **ya configuradas**  
**Backend completo** ✅ **con IA y sincronización automática**  
**Widget de chat** ✅ **responsivo y funcional**  
**Theme Extension** ✅ **lista para instalar**

Solo completa Supabase y OpenAI y ¡a testear! 🚀