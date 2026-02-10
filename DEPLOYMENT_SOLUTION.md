# Azure Deployment Issues - Solution Guide

## ❌ PROBLEMA IDENTIFICADO

Los deployments desde GitHub Actions fallan con **error 409 (Conflict)** debido a:

1. **Secret faltante o incorrecto**: `AZUREAPPSERVICE_PUBLISHPROFILE` en GitHub
2. **Workflows múltiples compitiendo** (YA RESUELTO)
3. **Configuración de Azure App Service**

## ✅ CAMBIOS YA IMPLEMENTADOS

### Fixes Técnicos Listos para Deploy:
- ✅ **Rate limits aumentados**: adminBypassRateLimit a 300/min
- ✅ **Funciones de carrito restauradas**: removeFromCartByItemId arreglado
- ✅ **Truncación de productos solucionada**: CSS text-overflow removido
- ✅ **Workflows limpiados**: Solo uno activo, con concurrency control

### Archivos Corregidos:
- `backend/src/middleware/rateLimiter.ts` - Rate limits aumentados
- `backend/public/naay-widget.js` - Cart removal functions fixed
- `backend/public/admin/index.html` - Product name truncation fixed
- `.github/workflows/` - Cleaned up, only one active workflow

## 🔧 SOLUCIONES DISPONIBLES

### Opción 1: Configurar GitHub Secret (RECOMENDADO)

1. Ve a tu repositorio en GitHub
2. **Settings** → **Secrets and variables** → **Actions**
3. Create **New repository secret**:
   - Name: `AZUREAPPSERVICE_PUBLISHPROFILE`
   - Value: El XML completo del archivo `GITHUB_SECRETS_SETUP.md` (líneas 18-19)

4. Haz push cualquier cambio para triggear deployment automático

### Opción 2: Manual Deployment (INMEDIATO)

```bash
# Ejecuta este comando para crear package de deployment:
./scripts/manual-azure-deploy.sh
```

Luego:
1. Ve a https://portal.azure.com
2. Busca: `naay-agent-app1763504937`
3. **Deployment Center** → **ZIP Deploy**
4. Sube el archivo `azure-manual-deploy.zip`

### Opción 3: Azure CLI (SI TIENES AZURE CLI)

```bash
# Después de ejecutar ./scripts/manual-azure-deploy.sh:
az webapp deployment source config-zip \
  --src azure-manual-deploy.zip \
  --name naay-agent-app1763504937 \
  --resource-group naay-agent-rg
```

## 🧪 VERIFICAR DEPLOYMENT

Una vez deployado, verifica que los fixes funcionen:

```bash
# 1. Health check
curl https://app.heykova.io/health

# 2. Rate limit test (ya no debería dar 429)
curl https://app.heykova.io/api/admin-bypass/stats?shopDomain=test.myshopify.com

# 3. Widget test
curl https://app.heykova.io/naay-widget.js | head -5
```

## 📋 PRÓXIMOS PASOS

1. **INMEDIATO**: Usar manual deployment o configurar GitHub secret
2. **Verificar**: Que todos los fixes funcionan en producción
3. **Confirmar**: Dashboard sin 429 errors, carrito funcional, nombres completos
4. **Monitorear**: Logs y performance después del deployment

## 🎯 RESULTADO ESPERADO

Después del deployment exitoso:
- ❌ **No más errores 429** en admin dashboard
- ✅ **Productos con nombres completos** (no "Emulsio...")
- ✅ **Funciones de carrito** funcionando correctamente
- ✅ **Deployments automáticos** desde GitHub (una vez configurado el secret)

---

**URL de la aplicación**: https://app.heykova.io