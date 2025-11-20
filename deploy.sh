#!/bin/bash

# Azure custom deployment script for Naay Agent
echo "🚀 Starting Naay Agent Azure Deployment..."

# Set deployment source and target
DEPLOYMENT_SOURCE=${DEPLOYMENT_SOURCE:-"/home/site/repository"}
DEPLOYMENT_TARGET=${DEPLOYMENT_TARGET:-"/home/site/wwwroot"}

echo "📂 Deployment source: $DEPLOYMENT_SOURCE"
echo "📂 Deployment target: $DEPLOYMENT_TARGET"

# Run the Node.js build script
echo "🔧 Running Azure build script..."
cd "$DEPLOYMENT_SOURCE"
node build-azure.js

# Copy files to target
echo "📁 Copying files to target directory..."
cd "$DEPLOYMENT_SOURCE"

# Create target directory if it doesn't exist
mkdir -p "$DEPLOYMENT_TARGET"

# Copy necessary files
cp package*.json "$DEPLOYMENT_TARGET/"
cp index.js "$DEPLOYMENT_TARGET/"
cp startup.js "$DEPLOYMENT_TARGET/"

# Copy node_modules for root dependencies (basic ones needed for startup)
if [ -d "node_modules" ]; then
  echo "📦 Copying root node_modules..."
  cp -r node_modules "$DEPLOYMENT_TARGET/"
fi

# Copy backend
echo "📦 Copying backend..."
mkdir -p "$DEPLOYMENT_TARGET/backend"
cp backend/package*.json "$DEPLOYMENT_TARGET/backend/"
cp -r backend/dist "$DEPLOYMENT_TARGET/backend/"
cp -r backend/public "$DEPLOYMENT_TARGET/backend/" 2>/dev/null || echo "⚠️ No backend/public directory found"

# Copy backend node_modules
if [ -d "backend/node_modules" ]; then
  echo "📦 Copying backend node_modules..."
  cp -r backend/node_modules "$DEPLOYMENT_TARGET/backend/"
fi

# Copy test-deploy as fallback
if [ -d "test-deploy" ]; then
  echo "📦 Copying test-deploy fallback..."
  cp -r test-deploy "$DEPLOYMENT_TARGET/"
fi

# Copy extensions
if [ -d "extensions" ]; then
  echo "📦 Copying Shopify extensions..."
  cp -r extensions "$DEPLOYMENT_TARGET/"
fi

# Copy other necessary files
for file in shopify.app.toml CLAUDE.md README.md; do
  if [ -f "$file" ]; then
    cp "$file" "$DEPLOYMENT_TARGET/"
  fi
done

echo "✅ Deployment completed successfully!"
echo "📊 Directory structure:"
ls -la "$DEPLOYMENT_TARGET"

echo "🔍 Backend structure:"
if [ -d "$DEPLOYMENT_TARGET/backend" ]; then
  ls -la "$DEPLOYMENT_TARGET/backend"
fi

echo "🎯 Final checks:"
echo "- index.js exists: $([ -f "$DEPLOYMENT_TARGET/index.js" ] && echo "✅" || echo "❌")"
echo "- startup.js exists: $([ -f "$DEPLOYMENT_TARGET/startup.js" ] && echo "✅" || echo "❌")"
echo "- backend/dist exists: $([ -d "$DEPLOYMENT_TARGET/backend/dist" ] && echo "✅" || echo "❌")"
echo "- node_modules exists: $([ -d "$DEPLOYMENT_TARGET/node_modules" ] && echo "✅" || echo "❌")"
echo "- backend/node_modules exists: $([ -d "$DEPLOYMENT_TARGET/backend/node_modules" ] && echo "✅" || echo "❌")"

echo "🏁 Deployment script finished!"