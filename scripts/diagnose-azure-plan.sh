#!/bin/bash

# Azure Plan Diagnostic Script
# Checks if deployment issues are related to plan limitations

echo "🔍 Diagnosing Azure App Service Plan..."
echo "=================================="
echo ""

# Check if Azure CLI is installed
if command -v az &> /dev/null; then
    echo "✅ Azure CLI found"
    
    # Try to get app service plan info
    echo ""
    echo "📊 Checking App Service Plan details..."
    
    az webapp show --name naay-agent-app1763504937 --resource-group naay-agent-rg --query '{name:name,state:state,kind:kind,location:location}' --output table 2>/dev/null || echo "❌ Could not retrieve app info (need to login: az login)"
    
    az appservice plan show --name $(az webapp show --name naay-agent-app1763504937 --resource-group naay-agent-rg --query 'appServicePlanId' --output tsv | xargs basename) --resource-group naay-agent-rg --query '{name:name,kind:kind,sku:sku,status:status}' --output table 2>/dev/null || echo "❌ Could not retrieve plan info"
    
    echo ""
    echo "💡 To check plan limitations:"
    echo "az appservice plan list --resource-group naay-agent-rg --output table"
    
else
    echo "❌ Azure CLI not installed"
    echo "💡 Install with: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
fi

echo ""
echo "🌐 Checking app accessibility..."
echo "================================="

# Test app endpoints
echo "Health endpoint:"
curl -s -w "HTTP Status: %{http_code}\n" "https://naay-agent-app1763504937.azurewebsites.net/health" | head -3

echo ""
echo "🔍 Common Azure Free Plan Limitations:"
echo "====================================="
echo "❌ Free Plan (F1) Issues:"
echo "   • Limited to 1 GB disk space"
echo "   • 60 minutes compute time per day"
echo "   • Always On not supported (causes cold starts)"
echo "   • Deployment slots not supported"
echo "   • Custom domains limited"
echo "   • SSL not included"
echo ""
echo "✅ Basic Plan (B1) Benefits:"
echo "   • 10 GB disk space"
echo "   • No compute time limits"
echo "   • Always On supported"
echo "   • Custom domains and SSL"
echo "   • More reliable deployments"
echo ""
echo "🚀 Standard Plan (S1) Benefits:"
echo "   • 50 GB disk space"
echo "   • Deployment slots (staging)"
echo "   • Auto-scaling"
echo "   • Backup/restore"
echo "   • Traffic Manager integration"

echo ""
echo "💰 Plan Upgrade Options:"
echo "========================"
echo "Basic B1:   ~$13-15/month"
echo "Standard S1: ~$56-70/month"
echo ""
echo "🔧 Recommended: Upgrade to Basic B1 minimum for:"
echo "   • Reliable GitHub Actions deployments"
echo "   • Always On (no cold starts)"
echo "   • Better performance for your Shopify app"

echo ""
echo "📋 To upgrade via Azure Portal:"
echo "1. Go to https://portal.azure.com"
echo "2. Find: naay-agent-app1763504937"
echo "3. Left menu: Scale up (App Service plan)"
echo "4. Choose Basic B1 or higher"
echo "5. Click Apply"

echo ""
echo "📋 To upgrade via Azure CLI:"
echo "az appservice plan update --name [PLAN_NAME] --resource-group naay-agent-rg --sku B1"