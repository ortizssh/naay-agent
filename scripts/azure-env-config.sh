#!/bin/bash

# Script to configure Azure App Service environment variables
# Usage: ./azure-env-config.sh <resource-group> <app-name>

set -e

RESOURCE_GROUP=$1
APP_NAME=$2

if [ -z "$RESOURCE_GROUP" ] || [ -z "$APP_NAME" ]; then
    echo "❌ Usage: $0 <resource-group> <app-name>"
    echo "Example: $0 naay-rg naay-agent-xyz123"
    exit 1
fi

echo "🔧 Configuring Azure App Service environment variables..."
echo "Resource Group: $RESOURCE_GROUP"
echo "App Name: $APP_NAME"

# Check if Azure CLI is installed and logged in
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI not found. Please install: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check login status
if ! az account show &> /dev/null; then
    echo "❌ Not logged in to Azure. Please run: az login"
    exit 1
fi

echo "✅ Azure CLI ready"

# Function to set app setting
set_app_setting() {
    local key=$1
    local value=$2
    local slot=$3
    
    if [ -n "$slot" ]; then
        echo "Setting $key in $slot slot..."
        az webapp config appsettings set \
            --resource-group "$RESOURCE_GROUP" \
            --name "$APP_NAME" \
            --slot "$slot" \
            --settings "$key=$value" \
            --output none
    else
        echo "Setting $key in production..."
        az webapp config appsettings set \
            --resource-group "$RESOURCE_GROUP" \
            --name "$APP_NAME" \
            --settings "$key=$value" \
            --output none
    fi
}

# Production URL
PROD_URL="https://$APP_NAME.azurewebsites.net"
STAGING_URL="https://$APP_NAME-staging.azurewebsites.net"

echo "📝 Setting up production environment variables..."

# Core Shopify settings (already configured)
set_app_setting "SHOPIFY_API_KEY" "1c7a47abe69b8020f7ed37d3528e0552"
set_app_setting "SHOPIFY_API_SECRET" "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"
set_app_setting "SHOPIFY_APP_URL" "$PROD_URL"
set_app_setting "SHOPIFY_SCOPES" "read_products,write_products,read_orders,read_customers,write_draft_orders"

# Node.js and Azure specific
set_app_setting "NODE_ENV" "production"
set_app_setting "WEBSITES_ENABLE_APP_SERVICE_STORAGE" "false"
set_app_setting "SCM_DO_BUILD_DURING_DEPLOYMENT" "false" 
set_app_setting "WEBSITE_NODE_DEFAULT_VERSION" "18.x"
set_app_setting "PORT" "8080"

# Application settings (placeholders - update with real values)
echo "⚠️  Setting placeholder values - UPDATE THESE IN AZURE PORTAL:"

set_app_setting "SUPABASE_URL" "https://your-project.supabase.co"
set_app_setting "SUPABASE_ANON_KEY" "your_anon_key_here"
set_app_setting "SUPABASE_SERVICE_KEY" "your_service_role_key_here"
set_app_setting "OPENAI_API_KEY" "sk-your_openai_key_here"
set_app_setting "OPENAI_MODEL" "gpt-4"
set_app_setting "EMBEDDING_MODEL" "text-embedding-3-small"

# Security and operational
set_app_setting "JWT_SECRET" "$(openssl rand -base64 32)"
set_app_setting "LOG_LEVEL" "info"
set_app_setting "REDIS_URL" "redis://localhost:6379"
set_app_setting "RATE_LIMIT_WINDOW_MS" "900000"
set_app_setting "RATE_LIMIT_MAX_REQUESTS" "100"

echo "📝 Setting up staging environment variables..."

# Staging slot configuration
set_app_setting "NODE_ENV" "staging" "staging"
set_app_setting "SHOPIFY_APP_URL" "$STAGING_URL" "staging"
set_app_setting "LOG_LEVEL" "debug" "staging"

# Copy other settings to staging
set_app_setting "SHOPIFY_API_KEY" "1c7a47abe69b8020f7ed37d3528e0552" "staging"
set_app_setting "SHOPIFY_API_SECRET" "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" "staging"
set_app_setting "SUPABASE_URL" "https://your-project.supabase.co" "staging"
set_app_setting "SUPABASE_ANON_KEY" "your_anon_key_here" "staging"
set_app_setting "SUPABASE_SERVICE_KEY" "your_service_role_key_here" "staging"
set_app_setting "OPENAI_API_KEY" "sk-your_openai_key_here" "staging"

echo "✅ Environment variables configured!"
echo ""
echo "🔗 Useful URLs:"
echo "Production: $PROD_URL"
echo "Staging: $STAGING_URL"
echo "Azure Portal: https://portal.azure.com/#@/resource/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Web/sites/$APP_NAME"
echo ""
echo "📝 IMPORTANT: Update these environment variables in Azure Portal with real values:"
echo "   1. SUPABASE_URL - Your Supabase project URL"
echo "   2. SUPABASE_ANON_KEY - Your Supabase anon key" 
echo "   3. SUPABASE_SERVICE_KEY - Your Supabase service role key"
echo "   4. OPENAI_API_KEY - Your OpenAI API key"
echo "   5. REDIS_URL - Redis connection string (if using external Redis)"
echo ""
echo "🚀 After updating variables, restart the app:"
echo "   az webapp restart --resource-group $RESOURCE_GROUP --name $APP_NAME"