# 🚀 Azure Deployment Guide - Naay Agent

Guía completa para desplegar Naay Agent en Azure App Service usando GitHub Actions.

## 📋 Prerequisitos

### Cuentas Requeridas
- ✅ **Azure Subscription** activa
- ✅ **GitHub Repository** con el código
- ✅ **Supabase Account** y proyecto creado
- ✅ **OpenAI Account** con API key

### Herramientas Necesarias
- ✅ **Azure CLI** instalado y configurado
- ✅ **PowerShell** (para scripts de Windows) 
- ✅ **Git** para el repositorio

## 🏗️ Deployment Automático (Opción Recomendada)

### 1. Setup Azure Resources

#### Opción A: PowerShell Script (Automático)
```powershell
# Ejecutar en PowerShell o Azure Cloud Shell
cd naay-agent

# Login a Azure (si no estás logueado)
Connect-AzAccount

# Ejecutar script de setup
./scripts/azure-setup.ps1 -ResourceGroupName "naay-rg" -AppName "naay-agent"
```

#### Opción B: Azure CLI Manual
```bash
# Login a Azure
az login

# Crear resource group
az group create --name naay-rg --location "East US"

# Deploy usando ARM template
az deployment group create \
  --resource-group naay-rg \
  --template-file azure-config/azure-deploy.json \
  --parameters appName=naay-agent location="East US" sku=B1
```

### 2. Configurar Variables de Entorno

```bash
# Ejecutar script de configuración
./scripts/azure-env-config.sh naay-rg naay-agent-[unique-id]

# O manualmente en Azure Portal
```

### 3. Setup GitHub Actions

1. **Push código a GitHub:**
```bash
git add .
git commit -m "Add Azure deployment configuration"
git push origin main
```

2. **Configurar GitHub Secrets:**
   - Ve a GitHub Repository > Settings > Secrets and variables > Actions
   - Agregar secrets:

```
AZUREAPPSERVICE_PUBLISHPROFILE: [Download from Azure Portal]
AZUREAPPSERVICE_PUBLISHPROFILE_STAGING: [Download staging slot profile]
```

3. **GitHub Actions se ejecutará automáticamente** al hacer push a `main`.

## ⚙️ Configuración Manual Paso a Paso

### 1. Crear Azure App Service

```bash
# Variables
RESOURCE_GROUP="naay-rg"
APP_NAME="naay-agent-$(date +%s)"
LOCATION="East US"

# Crear resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Crear App Service Plan
az appservice plan create \
  --name "${APP_NAME}-plan" \
  --resource-group $RESOURCE_GROUP \
  --sku B1 \
  --is-linux

# Crear Web App
az webapp create \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --plan "${APP_NAME}-plan" \
  --runtime "NODE|18-lts"

# Crear staging slot
az webapp deployment slot create \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --slot staging
```

### 2. Configurar App Settings

```bash
# Configuraciones de Node.js
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings \
    NODE_ENV=production \
    WEBSITES_ENABLE_APP_SERVICE_STORAGE=false \
    SCM_DO_BUILD_DURING_DEPLOYMENT=false \
    WEBSITE_NODE_DEFAULT_VERSION=18.x

# Configuraciones de Shopify (ya integradas)
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings \
    SHOPIFY_API_KEY=1c7a47abe69b8020f7ed37d3528e0552 \
    SHOPIFY_API_SECRET=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 \
    SHOPIFY_APP_URL=https://${APP_NAME}.azurewebsites.net
```

### 3. Configurar Deployment desde GitHub

```bash
# Configurar source control
az webapp deployment source config \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --repo-url https://github.com/tu-usuario/naay-agent \
  --branch main \
  --manual-integration
```

## 🔧 Variables de Entorno Requeridas

### En Azure Portal > App Service > Configuration:

```env
# ✅ Shopify (ya configuradas)
SHOPIFY_API_KEY=1c7a47abe69b8020f7ed37d3528e0552
SHOPIFY_API_SECRET=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
SHOPIFY_APP_URL=https://tu-app.azurewebsites.net
SHOPIFY_SCOPES=read_products,write_products,read_orders,read_customers,write_draft_orders

# ⚠️ Completar con tus valores
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_KEY=tu_service_role_key
OPENAI_API_KEY=sk-tu_openai_key

# 🔧 Configuración del servidor
NODE_ENV=production
JWT_SECRET=tu_jwt_secret_seguro
LOG_LEVEL=info
PORT=8080
REDIS_URL=redis://localhost:6379
```

## 🚀 Proceso de Deploy con GitHub Actions

### Workflow Automático

El workflow `.github/workflows/deploy-azure.yml` se ejecuta cuando:
- ✅ Push a `main` branch (deploy a producción)
- ✅ Pull Request (deploy a staging)

### Pasos del Deploy
1. **Build** - Instala dependencias y compila código
2. **Test** - Ejecuta tests del backend
3. **Package** - Crea paquete optimizado para Azure
4. **Deploy** - Despliega a Azure App Service

### Monitoreo del Deploy
```bash
# Ver logs de deploy
az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP

# Ver status del app
az webapp show --name $APP_NAME --resource-group $RESOURCE_GROUP --query state
```

## 🔍 Testing Post-Deploy

### 1. Health Checks
```bash
# Verificar que el backend responde
curl https://tu-app.azurewebsites.net/health

# Verificar chat service
curl https://tu-app.azurewebsites.net/api/chat/health
```

### 2. Configurar Shopify App

1. **Actualizar URLs en Partner Dashboard:**
   - App URL: `https://tu-app.azurewebsites.net`
   - Redirect URLs: `https://tu-app.azurewebsites.net/auth/callback`

2. **Actualizar webhooks:**
   - Products create: `https://tu-app.azurewebsites.net/api/webhooks/products/create`
   - Products update: `https://tu-app.azurewebsites.net/api/webhooks/products/update`
   - Products delete: `https://tu-app.azurewebsites.net/api/webhooks/products/delete`

### 3. Deploy Widget CDN

```bash
# Build widget para producción
cd frontend-widget
npm run build

# Subir a Azure Blob Storage o CDN de tu preferencia
# Actualizar URL en Theme Extension
```

## 📊 Monitoreo y Logs

### Application Insights (Recomendado)

```bash
# Crear Application Insights
az monitor app-insights component create \
  --app naay-agent-insights \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP

# Configurar en App Service
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY=<instrumentation-key>
```

### Logs en Tiempo Real

```bash
# Stream logs
az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP

# Download logs
az webapp log download --name $APP_NAME --resource-group $RESOURCE_GROUP
```

## 🔧 Troubleshooting

### Problemas Comunes

#### App no inicia
```bash
# Verificar logs
az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP

# Verificar configuración
az webapp config show --name $APP_NAME --resource-group $RESOURCE_GROUP
```

#### Variables de entorno faltantes
```bash
# Listar configuración actual
az webapp config appsettings list --name $APP_NAME --resource-group $RESOURCE_GROUP

# Actualizar variable específica
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings VARIABLE_NAME=new_value
```

#### Performance issues
```bash
# Escalar hacia arriba
az appservice plan update \
  --name "${APP_NAME}-plan" \
  --resource-group $RESOURCE_GROUP \
  --sku S1

# Habilitar always on
az webapp config set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --always-on true
```

## 💰 Costos Estimados

### App Service Plan B1 (Recomendado para desarrollo)
- **$13.14 USD/mes**
- 1 Core, 1.75GB RAM
- Custom domain + SSL

### App Service Plan S1 (Recomendado para producción)
- **$56.94 USD/mes**  
- 1 Core, 1.75GB RAM
- Always On, Auto-scaling

### Servicios Adicionales
- **Application Insights**: ~$2-5/mes
- **Azure Blob Storage** (para widget): ~$1/mes

## 📚 Recursos Adicionales

- [Azure App Service Documentation](https://docs.microsoft.com/en-us/azure/app-service/)
- [GitHub Actions for Azure](https://docs.microsoft.com/en-us/azure/app-service/deploy-github-actions)
- [Node.js on Azure App Service](https://docs.microsoft.com/en-us/azure/app-service/quickstart-nodejs)
- [Azure CLI Reference](https://docs.microsoft.com/en-us/cli/azure/)

## 🆘 Soporte

### URLs Importantes
- **Azure Portal**: https://portal.azure.com
- **Resource Group**: https://portal.azure.com/#@/resource/subscriptions/[subscription-id]/resourceGroups/naay-rg
- **Application Logs**: Azure Portal > App Service > Log stream

### Comandos Útiles
```bash
# Reiniciar app
az webapp restart --name $APP_NAME --resource-group $RESOURCE_GROUP

# Ver métricas
az monitor metrics list --resource $APP_NAME --resource-group $RESOURCE_GROUP --resource-type Microsoft.Web/sites

# Backup configuración
az webapp config backup create --resource-group $RESOURCE_GROUP --webapp-name $APP_NAME
```