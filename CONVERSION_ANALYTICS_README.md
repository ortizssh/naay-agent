# 🎯 Conversión Analytics - Sistema Retroactivo

## Descripción

Sistema completo de análisis de conversiones que permite calcular ventas históricas desde el inicio de las conversaciones en la base de datos. Utiliza la tabla `simple_recommendations` existente y crea conversiones históricas basadas en órdenes de Shopify.

## ✨ Características

### 🔄 Análisis Retroactivo
- **Backfill Inteligente**: Extrae recomendaciones históricas de mensajes de chat pasados
- **Matching Avanzado**: Conecta recomendaciones con órdenes usando ventanas de atribución
- **Análisis Multiidioma**: Optimizado para contenido en español y patrones de productos de belleza

### 📊 Dashboard Completo
- **KPIs en Tiempo Real**: Tasa de conversión, revenue, tiempo promedio
- **Timeline Histórico**: Visualización de conversiones por día/semana/mes
- **Top Productos**: Ranking de productos con mejor conversión
- **Ventanas de Atribución**: Direct (0-30min), Assisted (30min-24h), View-through (24h-7d)

### 🛠️ APIs Robustas
- Endpoints para dashboard completo
- Funciones SQL optimizadas para agregaciones
- Sistema de caché integrado

## 🚀 Instalación y Configuración

### 1. Preparar Base de Datos

```bash
# Instalar funciones SQL (esto elimina funciones existentes y las reinstala)
psql -d your_database -f database/install_conversion_functions.sql

# O desde Supabase SQL Editor, ejecutar el contenido de:
# database/install_conversion_functions.sql
```

### 2. Compilar Backend

```bash
cd backend
npm run build
```

### 3. Ejecutar Análisis Histórico

#### Backfill Básico (Recomendado para primera vez)
```bash
node scripts/backfill-historical-conversions.js naay.cl --verbose
```

#### Backfill con Fechas Específicas
```bash
node scripts/backfill-historical-conversions.js naay.cl --from-date 2024-01-01 --to-date 2024-12-15 --verbose
```

#### Solo Backfill de Recomendaciones
```bash
node scripts/backfill-historical-conversions.js naay.cl --backfill-only
```

#### Solo Procesamiento de Conversiones
```bash
node scripts/backfill-historical-conversions.js naay.cl --conversions-only
```

#### Dry Run (Ver qué haría sin ejecutar)
```bash
node scripts/backfill-historical-conversions.js naay.cl --dry-run --verbose
```

## 📋 Estructura de Datos

### Tablas Principales

#### `simple_recommendations` (Existente)
- Almacena recomendaciones de IA en tiempo real
- Cada recomendación tiene ventana de expiración
- Incluye `session_id`, `product_id`, `product_title`

#### `simple_conversions` (Utilizada)
- Conversiones confirmadas (recomendación → compra)
- Incluye ventana de atribución y revenue
- Conecta con órdenes de Shopify

### Ventanas de Atribución

| Tipo | Tiempo | Descripción |
|------|---------|-------------|
| **Direct** | 0-30 min | Compra inmediata después de recomendación |
| **Assisted** | 30min-24h | Compra influenciada por recomendación |
| **View-through** | 24h-7d | Compra con exposición previa |

## 🔧 APIs Disponibles

### Dashboard Principal
```bash
GET /api/admin-bypass/conversions/dashboard?shop=naay.cl&days=30
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalRecommendations": 150,
      "totalConversions": 23,
      "conversionRate": 15.33,
      "totalRevenue": 1250.50,
      "averageOrderValue": 54.37,
      "averageTimeToConversion": 127.5
    },
    "timeline": [...],
    "topProducts": [...],
    "attributionBreakdown": {...},
    "periodComparison": {...}
  }
}
```

### Resumen de Conversiones
```bash
GET /api/admin-bypass/conversions/summary?shop=naay.cl
```

### Top Productos Convertidores
```bash
GET /api/admin-bypass/conversions/top-products?shop=naay.cl&limit=10&days=30
```

### Backfill Manual via API
```bash
POST /api/admin-bypass/conversions/backfill-recommendations
Content-Type: application/json

{
  "shop": "naay.cl",
  "fromDate": "2024-01-01",
  "toDate": "2024-12-15"
}
```

### Procesar Conversiones via API
```bash
POST /api/admin-bypass/conversions/process-historical
Content-Type: application/json

{
  "shop": "naay.cl"
}
```

## 📈 Interpretación de Métricas

### KPIs Clave

| Métrica | Fórmula | Interpretación |
|---------|---------|----------------|
| **Conversion Rate** | (Conversiones / Recomendaciones) × 100 | % de recomendaciones que generan venta |
| **Average Order Value** | Revenue Total / Conversiones | Valor promedio por conversión |
| **Time to Conversion** | Promedio(minutos_entre_recomendación_y_compra) | Velocidad de decisión de compra |
| **Attribution Revenue** | Suma(revenue_atribuido) | Ingresos directamente atribuibles al AI |

### Benchmarks de Rendimiento

| Métrica | Excelente | Bueno | Regular | Requiere Atención |
|---------|-----------|-------|---------|-------------------|
| **Conversion Rate** | >20% | 15-20% | 10-15% | <10% |
| **Time to Conversion** | <60min | 60-300min | 300-1440min | >1440min |
| **AOV Growth** | >10% vs período anterior | 5-10% | 0-5% | <0% |

## 🔍 Casos de Uso

### 1. Análisis de Rendimiento Histórico
```bash
# Obtener métricas completas del último trimestre
curl "https://tu-api.com/api/admin-bypass/conversions/dashboard?shop=naay.cl&days=90"
```

### 2. Optimización de Recomendaciones
```bash
# Identificar productos con mejor conversión
curl "https://tu-api.com/api/admin-bypass/conversions/top-products?shop=naay.cl&days=30"
```

### 3. Monitoreo de Tendencias
- Comparar períodos para identificar mejoras/deterioros
- Analizar impacto de cambios en algoritmo de recomendaciones
- Evaluar efectividad de nuevos productos

## 🛠️ Troubleshooting

### Error: "cannot change return type of existing function"
```sql
-- Solución: Usar el script de instalación que elimina las funciones existentes
-- En Supabase SQL Editor o psql:
-- Ejecutar el contenido completo de database/install_conversion_functions.sql
```

### Error: "Shop not found"
```bash
# Verificar shops disponibles
curl "https://tu-api.com/api/admin-bypass/conversions/summary?shop=SHOP_DOMAIN"
```

### Error: "No recommendations found"
```bash
# Verificar datos en tabla
SELECT COUNT(*) FROM simple_recommendations WHERE shop_domain = 'naay.cl';

# Si es 0, ejecutar backfill
node scripts/backfill-historical-conversions.js naay.cl --backfill-only --verbose
```

### Error: "Shopify API failed"
```bash
# Verificar credenciales
curl "https://tu-shopify-store.myshopify.com/admin/api/2023-10/orders.json?limit=1" \
     -H "X-Shopify-Access-Token: YOUR_TOKEN"
```

### Performance Lento
```bash
# Ejecutar con menos días para probar
node scripts/backfill-historical-conversions.js naay.cl --from-date 2024-12-01 --verbose

# O usar dry-run para estimar tiempo
node scripts/backfill-historical-conversions.js naay.cl --dry-run
```

## 📊 Funciones SQL Avanzadas

### Estadísticas Diarias
```sql
SELECT * FROM get_daily_conversion_stats('naay.cl', 30);
```

### Top Productos con Detalles
```sql
SELECT * FROM get_top_converting_products('naay.cl', NOW() - INTERVAL '30 days', 10);
```

### Análisis de Embudo
```sql
SELECT * FROM get_conversion_funnel_stats('naay.cl');
```

### Rendimiento por Ventana de Atribución
```sql
SELECT * FROM get_attribution_window_performance('naay.cl');
```

## 🔄 Automatización

### Cron Job para Análisis Diario
```bash
# Agregar a crontab para ejecutar diariamente a las 2 AM
0 2 * * * cd /path/to/naay-agent && node scripts/backfill-historical-conversions.js naay.cl --conversions-only >> /var/log/conversions.log 2>&1
```

### Webhook para Nuevas Órdenes
```javascript
// En webhook.controller.ts, agregar al procesar orders/paid
await enhancedConversionService.processHistoricalConversions(shop);
```

## 📱 Visualización Frontend

### Estructura de Dashboard Recomendada
```
┌─────────────────────────────────────────┐
│  📈 CONVERSIONES - ÚLTIMOS 30 DÍAS      │
├─────────────────────────────────────────┤
│ 🎯 15.4% Rate  💰 $12,450  ⏱️ 8.2min    │
├─────────────────────────────────────────┤
│ 📊 TIMELINE                             │
│ [Gráfico de líneas: Conversiones/día]   │
├─────────────────────────────────────────┤
│ 🏆 TOP PRODUCTOS                        │
│ 1. Crema Facial - 23% (15→3) $450      │
│ 2. Gel Limpiador - 18% (22→4) $380     │
├─────────────────────────────────────────┤
│ 🎯 ATRIBUCIÓN                           │
│ Direct: 12 conv ($890) | Assisted: 8 ($560) │
└─────────────────────────────────────────┘
```

### Componentes React Sugeridos
```typescript
// ConversionDashboard.tsx
interface ConversionDashboardProps {
  shop: string;
  days?: number;
}

// ConversionMetricsCard.tsx
// ConversionTimelineChart.tsx  
// TopProductsTable.tsx
// AttributionBreakdownChart.tsx
```

## 🎯 Roadmap

### Versión Actual (v1.0)
- ✅ Análisis retroactivo completo
- ✅ Dashboard con métricas clave
- ✅ APIs REST completas
- ✅ Ventanas de atribución

### Próximas Versiones
- 🔄 Dashboard frontend interactivo
- 📧 Alertas y notificaciones
- 🤖 ML para predicción de conversiones
- 📱 App móvil para métricas
- 🔗 Integración con Google Analytics

## 📞 Soporte

Para dudas o problemas:
1. Revisar logs: `backend/logs/`
2. Verificar configuración en `config/.env`
3. Ejecutar con `--verbose` para más detalles
4. Usar `--dry-run` para probar sin cambios

---

**¡El sistema está listo para analizar todas tus conversiones históricas y optimizar el rendimiento de tu AI assistant!** 🚀