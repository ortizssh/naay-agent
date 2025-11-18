#!/bin/bash

# Script para crear Web Service en Azure exclusivo para Naay Agent
# Ejecuta este script para crear todos los recursos necesarios

set -e

# Configuración
RESOURCE_GROUP="naay-agent-rg"
LOCATION="East US"
APP_SERVICE_PLAN="naay-agent-plan"
WEB_APP_NAME="naay-agent-$(date +%s)"
SKU="B1"  # Basic tier - cambiar a S1 para producción
NODE_VERSION="18-lts"

echo "🚀 Creando Azure Web Service para Naay Agent..."
echo "================================================"
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo "App Name: $WEB_APP_NAME"
echo "SKU: $SKU"
echo ""

# Verificar que Azure CLI está instalado y configurado
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI no está instalado."
    echo "Instalar desde: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Verificar login
if ! az account show &> /dev/null; then
    echo "❌ No estás logueado en Azure."
    echo "Ejecuta: az login"
    exit 1
fi

echo "✅ Azure CLI configurado correctamente"

# Mostrar información de la cuenta
ACCOUNT_INFO=$(az account show --query '{subscriptionId:id,tenantId:tenantId,user:user.name}' -o tsv)
echo "📋 Cuenta: $ACCOUNT_INFO"

# 1. Crear Resource Group
echo ""
echo "📁 Creando Resource Group..."
if az group show --name "$RESOURCE_GROUP" &> /dev/null; then
    echo "⚠️  Resource group '$RESOURCE_GROUP' ya existe, usando existente"
else
    az group create \
        --name "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --tags project=naay-agent environment=production
    echo "✅ Resource group creado: $RESOURCE_GROUP"
fi

# 2. Crear App Service Plan
echo ""
echo "🏗️  Creando App Service Plan..."
az appservice plan create \
    --name "$APP_SERVICE_PLAN" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --sku "$SKU" \
    --is-linux \
    --tags project=naay-agent

echo "✅ App Service Plan creado: $APP_SERVICE_PLAN"

# 3. Crear Web App
echo ""
echo "🌐 Creando Web App..."
az webapp create \
    --name "$WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --plan "$APP_SERVICE_PLAN" \
    --runtime "NODE|$NODE_VERSION" \
    --tags project=naay-agent environment=production

echo "✅ Web App creado: $WEB_APP_NAME"

# 4. Configurar Web App
echo ""
echo "⚙️  Configurando Web App..."

# Configuraciones básicas de Node.js
az webapp config appsettings set \
    --name "$WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --settings \
        WEBSITES_ENABLE_APP_SERVICE_STORAGE=false \
        SCM_DO_BUILD_DURING_DEPLOYMENT=false \
        WEBSITE_NODE_DEFAULT_VERSION=18.x \
        NODE_ENV=production \
        PORT=8080

# 5. Configurar variables de Shopify (ya integradas)
echo ""
echo "🛍️  Configurando credenciales de Shopify..."

WEB_APP_URL="https://$WEB_APP_NAME.azurewebsites.net"

az webapp config appsettings set \
    --name "$WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --settings \
        SHOPIFY_API_KEY=1c7a47abe69b8020f7ed37d3528e0552 \
        SHOPIFY_API_SECRET=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 \
        SHOPIFY_APP_URL="$WEB_APP_URL" \
        SHOPIFY_SCOPES="read_products,write_products,read_orders,read_customers,write_draft_orders" \
        SHOPIFY_WEBHOOK_SECRET="$(openssl rand -base64 32)"

# 6. Configurar variables de aplicación (placeholders)
echo ""
echo "🔧 Configurando variables de aplicación..."

az webapp config appsettings set \
    --name "$WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --settings \
        JWT_SECRET="$(openssl rand -base64 32)" \
        LOG_LEVEL=info \
        RATE_LIMIT_WINDOW_MS=900000 \
        RATE_LIMIT_MAX_REQUESTS=100 \
        OPENAI_MODEL=gpt-4 \
        EMBEDDING_MODEL=text-embedding-3-small

# Variables que necesitan ser actualizadas manualmente
az webapp config appsettings set \
    --name "$WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --settings \
        SUPABASE_URL="https://your-project.supabase.co" \
        SUPABASE_ANON_KEY="your_anon_key_here" \
        SUPABASE_SERVICE_KEY="your_service_role_key_here" \
        OPENAI_API_KEY="sk-your_openai_key_here" \
        REDIS_URL="redis://localhost:6379"

# 7. Crear staging slot
echo ""
echo "🔄 Creando staging slot..."
az webapp deployment slot create \
    --name "$WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --slot staging

# Configurar staging slot
STAGING_URL="https://$WEB_APP_NAME-staging.azurewebsites.net"

az webapp config appsettings set \
    --name "$WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --slot staging \
    --settings \
        NODE_ENV=staging \
        SHOPIFY_APP_URL="$STAGING_URL" \
        LOG_LEVEL=debug

echo "✅ Staging slot creado"

# 8. Configurar HTTPS y seguridad
echo ""
echo "🔒 Configurando seguridad..."
az webapp update \
    --name "$WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --https-only true

az webapp config set \
    --name "$WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --always-on true \
    --http20-enabled true \
    --min-tls-version 1.2

echo "✅ Configuración de seguridad aplicada"

# 9. Habilitar logs
echo ""
echo "📊 Configurando logging..."
az webapp log config \
    --name "$WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --application-logging filesystem \
    --detailed-error-messages true \
    --failed-request-tracing true \
    --web-server-logging filesystem

echo "✅ Logging configurado"

# 10. Obtener publish profile para GitHub Actions
echo ""
echo "📋 Obteniendo publish profile..."
mkdir -p ../secrets
az webapp deployment list-publishing-profiles \
    --name "$WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --xml > ../secrets/production-publish-profile.xml

az webapp deployment list-publishing-profiles \
    --name "$WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --slot staging \
    --xml > ../secrets/staging-publish-profile.xml

echo "✅ Publish profiles guardados en secrets/"

# 11. Resumen final
echo ""
echo "🎉 ¡Azure Web Service creado exitosamente!"
echo "========================================"
echo ""
echo "📋 Detalles del servicio:"
echo "Resource Group: $RESOURCE_GROUP"
echo "Web App Name: $WEB_APP_NAME"
echo "Production URL: $WEB_APP_URL"
echo "Staging URL: $STAGING_URL"
echo ""
echo "🔗 Links útiles:"
echo "Azure Portal: https://portal.azure.com/#@/resource/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Web/sites/$WEB_APP_NAME"
echo "App Service: https://portal.azure.com/#@/resource/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Web/sites/$WEB_APP_NAME/appServices"
echo ""
echo "⚠️  PRÓXIMOS PASOS REQUERIDOS:"
echo "1. Actualizar variables de entorno en Azure Portal:"
echo "   - SUPABASE_URL (tu proyecto de Supabase)"
echo "   - SUPABASE_ANON_KEY (anon key de Supabase)"
echo "   - SUPABASE_SERVICE_KEY (service role key de Supabase)"
echo "   - OPENAI_API_KEY (tu API key de OpenAI)"
echo "   - REDIS_URL (si usas Redis externo)"
echo ""
echo "2. Configurar GitHub Actions:"
echo "   - Agregar secret AZUREAPPSERVICE_PUBLISHPROFILE con contenido de secrets/production-publish-profile.xml"
echo "   - Agregar secret AZUREAPPSERVICE_PUBLISHPROFILE_STAGING con contenido de secrets/staging-publish-profile.xml"
echo ""
echo "3. Push código a GitHub para triggear deployment automático"
echo ""
echo "4. Actualizar Shopify App URLs:"
echo "   - App URL: $WEB_APP_URL"
echo "   - Redirect URLs: $WEB_APP_URL/auth/callback"
echo "   - Webhook URLs: $WEB_APP_URL/api/webhooks/*"
echo ""
echo "🚀 Una vez completados estos pasos, tu app estará lista para producción!"

# Crear archivo de configuración para referencia futura
cat > ../azure-service-info.txt << EOF
===========================================
NAAY AGENT - AZURE SERVICE INFORMACIÓN
===========================================

Resource Group: $RESOURCE_GROUP
Web App Name: $WEB_APP_NAME
Location: $LOCATION
SKU: $SKU

URLs:
- Production: $WEB_APP_URL
- Staging: $STAGING_URL

Azure Portal:
https://portal.azure.com/#@/resource/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP

Created: $(date)

VARIABLES DE ENTORNO A ACTUALIZAR:
- SUPABASE_URL
- SUPABASE_ANON_KEY  
- SUPABASE_SERVICE_KEY
- OPENAI_API_KEY
- REDIS_URL (opcional)

GITHUB SECRETS REQUERIDOS:
- AZUREAPPSERVICE_PUBLISHPROFILE
- AZUREAPPSERVICE_PUBLISHPROFILE_STAGING

COMANDOS ÚTILES:
- Ver logs: az webapp log tail --name $WEB_APP_NAME --resource-group $RESOURCE_GROUP
- Restart: az webapp restart --name $WEB_APP_NAME --resource-group $RESOURCE_GROUP
- Configuración: az webapp config appsettings list --name $WEB_APP_NAME --resource-group $RESOURCE_GROUP
EOF

echo ""
echo "📄 Información guardada en: azure-service-info.txt"