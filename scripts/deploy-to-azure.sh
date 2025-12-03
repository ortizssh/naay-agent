#!/bin/bash

# Script para deployment rápido a Azure
WEB_APP_NAME="naay-agent-app1763504937"
RESOURCE_GROUP="naay-agent-rg"

echo "🚀 Deployando Naay Agent a Azure..."
echo "Web App: $WEB_APP_NAME"

# Build del proyecto
echo "📦 Building backend..."
cd backend
npm run build

# Crear package de deployment
echo "📦 Creando package de deployment..."
cd ..
mkdir -p deploy-temp
cp -r backend/dist/* deploy-temp/
cp -r backend/node_modules deploy-temp/
cp backend/package.json deploy-temp/

# Crear web.config para Azure
cat > deploy-temp/web.config << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <webSocket enabled="false" />
    <handlers>
      <add name="iisnode" path="dist/index.js" verb="*" modules="iisnode"/>
    </handlers>
    <rewrite>
      <rules>
        <rule name="DynamicContent">
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="True"/>
          </conditions>
          <action type="Rewrite" url="dist/index.js"/>
        </rule>
      </rules>
    </rewrite>
    <iisnode watchedFiles="web.config;*.js" node_env="production" />
  </system.webServer>
</configuration>
EOF

# Crear archivo zip para deployment
echo "📁 Creando archivo de deployment..."
cd deploy-temp
zip -r ../naay-agent-deploy.zip .
cd ..

# Deploy a Azure
echo "🚀 Deploying a Azure..."
az webapp deploy --resource-group "$RESOURCE_GROUP" --name "$WEB_APP_NAME" --src-path "naay-agent-deploy.zip" --type zip

echo "✅ Deployment completado!"
echo "🌐 URL: https://$WEB_APP_NAME.azurewebsites.net"

# Cleanup
rm -rf deploy-temp
rm naay-agent-deploy.zip

echo "🔧 Configurar variables de entorno en Azure Portal:"
echo "https://portal.azure.com"