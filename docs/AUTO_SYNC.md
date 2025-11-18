# 🔄 Sincronización Automática de Productos

## 📋 Resumen

Naay Agent implementa sincronización automática de productos que se ejecuta inmediatamente después de la instalación de la app, asegurando que el catálogo esté disponible para el agente IA sin intervención manual.

## ⚡ Flujo de Sincronización Automática

### 1. **Instalación de la App**
```
Usuario instala app → OAuth callback → Sincronización automática
```

### 2. **Proceso Detallado**

1. **OAuth Callback** (`/auth/callback`)
   - ✅ Intercambia código por access token
   - ✅ Guarda/actualiza store en base de datos
   - ✅ **Genera JWT para sesión**
   - ✅ **🚀 Dispara job de sincronización automática**
   - ✅ Redirige al dashboard

2. **Job Queue System**
   ```typescript
   // Se ejecuta automáticamente tras instalación
   await queueService.addFullSyncJob(shop, accessToken);
   ```

3. **Sincronización en Background**
   - ✅ Obtiene todos los productos vía Admin API
   - ✅ Guarda productos y variantes en Supabase
   - ✅ Genera embeddings para búsqueda semántica
   - ✅ Procesa en lotes para optimizar rendimiento

## 🎯 Características Clave

### ✅ **Automático y Transparente**
- No requiere acción del usuario
- Se ejecuta inmediatamente tras instalación
- Feedback en tiempo real del progreso

### ✅ **Resiliente y Escalable**
- Queue system con Redis/BullMQ
- Manejo de errores con reintentos
- Procesamiento en background
- No bloquea la instalación

### ✅ **Sincronización Continua**
- Webhooks para cambios en tiempo real
- Updates automáticos de productos
- Regeneración de embeddings cuando es necesario

## 📊 Estados de Sincronización

```typescript
// Estados posibles del job
pending    → Esperando ser procesado
active     → Procesándose actualmente  
completed  → Sincronización completada
failed     → Error (con reintentos automáticos)
```

## 🔧 APIs de Monitoreo

### Verificar Estado de Sincronización
```http
GET /api/products/sync/status
Authorization: Bearer <jwt-token>
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "queues": {
      "sync": {
        "waiting": 0,
        "active": 1,
        "completed": 15,
        "failed": 0
      },
      "embeddings": {
        "waiting": 5,
        "active": 2,
        "completed": 150,
        "failed": 0
      }
    },
    "activeJobs": {
      "sync": [
        {
          "id": "job_123",
          "data": { "shop": "test-store.myshopify.com" },
          "progress": 75
        }
      ]
    }
  }
}
```

### Disparar Sincronización Manual
```http
POST /api/products/sync
Authorization: Bearer <jwt-token>
```

## 🔄 Webhooks de Sincronización Continua

### Eventos Manejados Automáticamente

1. **Producto Creado** (`products/create`)
   - ✅ Agrega producto a base de datos
   - ✅ Genera embeddings
   - ✅ Notificación en logs

2. **Producto Actualizado** (`products/update`)
   - ✅ Actualiza datos del producto
   - ✅ Regenera embeddings si cambió contenido
   - ✅ Mantiene historial de cambios

3. **Producto Eliminado** (`products/delete`)
   - ✅ Elimina producto de base de datos
   - ✅ Limpia embeddings relacionados
   - ✅ Actualiza índices vectoriales

## ⚙️ Configuración

### Variables de Entorno Requeridas
```env
# Redis para queue system
REDIS_URL=redis://localhost:6379

# OpenAI para embeddings
OPENAI_API_KEY=your_openai_key
EMBEDDING_MODEL=text-embedding-3-small

# Configuración de queue
SYNC_CONCURRENCY=2
EMBEDDING_CONCURRENCY=5
```

### Configuración de Queue
```typescript
// En queue.service.ts
defaultJobOptions: {
  removeOnComplete: 100,    // Mantener últimos 100 jobs completados
  removeOnFail: 50,         // Mantener últimos 50 jobs fallidos
  attempts: 3,              // 3 intentos por job
  backoff: {
    type: 'exponential',
    delay: 2000             // Delay exponencial entre reintentos
  }
}
```

## 📈 Performance y Optimización

### Procesamiento en Lotes
- **Productos**: 50 productos por lote de Admin API
- **Embeddings**: 5 embeddings simultáneos
- **Memoria**: Cleanup automático de jobs antiguos

### Límites de Rate
- **Admin API**: Respeta límites de Shopify (40 calls/app/second)
- **OpenAI API**: Procesa embeddings en lotes
- **Database**: Connection pooling optimizado

## 🚨 Manejo de Errores

### Estrategias de Recuperación
1. **Reintentos Automáticos**: 3 intentos con backoff exponencial
2. **Logging Detallado**: Tracking completo de errores
3. **Fallback Manual**: API para re-sincronizar manualmente
4. **Alertas**: Notificaciones de fallos críticos

### Errores Comunes y Soluciones

| Error | Causa | Solución |
|-------|-------|----------|
| `Token Invalid` | Access token revocado | Re-autorización OAuth |
| `Rate Limit` | Demasiadas requests | Backoff automático |
| `OpenAI Quota` | Límite de API excedido | Queue en pausa temporal |
| `DB Connection` | Supabase no disponible | Reintentos con exponential backoff |

## 📋 Checklist Post-Instalación

### ✅ Verificaciones Automáticas
- [ ] Store guardada en base de datos
- [ ] Job de sincronización iniciado
- [ ] Webhooks configurados
- [ ] Productos sincronizados
- [ ] Embeddings generados
- [ ] Búsqueda semántica funcionando

### 🧪 Testing
```bash
# Verificar salud del sistema
curl -X GET https://your-app.com/health/detailed

# Verificar estado de sincronización
curl -X GET https://your-app.com/api/products/sync/status \
  -H "Authorization: Bearer YOUR_JWT"

# Probar búsqueda semántica
curl -X GET "https://your-app.com/api/products/search?q=red+dress" \
  -H "Authorization: Bearer YOUR_JWT"
```

## 🎉 Resultado Final

Una vez completada la sincronización automática:

1. ✅ **Catálogo completo** disponible en Supabase
2. ✅ **Búsqueda semántica** funcionando con pgvector
3. ✅ **Webhooks activos** para sincronización continua
4. ✅ **Agent IA** listo para interactuar con productos
5. ✅ **Zero configuración** requerida del usuario

La sincronización es **completamente transparente** para el usuario final - simplemente instala la app y el agente está listo para ayudar a sus clientes.