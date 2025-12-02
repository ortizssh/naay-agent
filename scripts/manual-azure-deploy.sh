#!/bin/bash

# Manual Azure Deployment Script
# Use this as alternative to GitHub Actions

set -e

echo "🚀 Starting manual Azure deployment..."

# Build the application
echo "📦 Building application..."
cd backend
npm run build
cd ..

# Create deployment package
echo "📋 Creating deployment package..."
rm -rf manual-deploy
mkdir manual-deploy

# Copy built application
cp -r backend/dist manual-deploy/
cp -r backend/node_modules manual-deploy/

# Create app.js entry point for Azure PM2
cat > manual-deploy/app.js << 'EOF'
// Azure App Service entry point
// This file is required by Azure's PM2 configuration
require('./dist/index.js');
EOF

# Create package.json for Azure
cat > manual-deploy/package.json << 'EOF'
{
  "name": "naay-agent",
  "version": "1.0.0",
  "main": "app.js",
  "scripts": {
    "start": "node app.js"
  },
  "engines": {
    "node": "20.x"
  }
}
EOF

# Create web.config for IIS
cat > manual-deploy/web.config << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
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
    <iisnode node_env="production" />
  </system.webServer>
</configuration>
EOF

# Create deployment ZIP
echo "📦 Creating deployment ZIP..."
cd manual-deploy
zip -r ../azure-manual-deploy.zip . -q
cd ..

echo "✅ Deployment package created: azure-manual-deploy.zip"
echo ""
echo "🔧 Next steps:"
echo "1. Go to https://portal.azure.com"
echo "2. Find your app: naay-agent-app1763504937"
echo "3. Go to Deployment Center → Deployment slots → Production"
echo "4. Choose 'Local Git' or 'ZIP Deploy'"
echo "5. Upload the azure-manual-deploy.zip file"
echo ""
echo "Or use Azure CLI:"
echo "az webapp deployment source config-zip --src azure-manual-deploy.zip --name naay-agent-app1763504937 --resource-group naay-agent-rg"
echo ""
echo "🌐 App URL: https://naay-agent-app1763504937.azurewebsites.net"

# Cleanup
rm -rf manual-deploy