# Azure deployment script for Naay Agent
# Run this in PowerShell or Azure Cloud Shell

param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName,
    
    [Parameter(Mandatory=$true)]
    [string]$AppName,
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "East US",
    
    [Parameter(Mandatory=$false)]
    [string]$Sku = "B1"
)

Write-Host "🚀 Setting up Naay Agent in Azure..." -ForegroundColor Green
Write-Host "Resource Group: $ResourceGroupName" -ForegroundColor Yellow
Write-Host "App Name: $AppName" -ForegroundColor Yellow
Write-Host "Location: $Location" -ForegroundColor Yellow

# Check if logged in to Azure
try {
    $context = Get-AzContext
    if (-not $context) {
        throw "Not logged in"
    }
    Write-Host "✅ Logged in to Azure as: $($context.Account.Id)" -ForegroundColor Green
} catch {
    Write-Host "❌ Please log in to Azure first: Connect-AzAccount" -ForegroundColor Red
    exit 1
}

# Create resource group if it doesn't exist
$rg = Get-AzResourceGroup -Name $ResourceGroupName -ErrorAction SilentlyContinue
if (-not $rg) {
    Write-Host "📁 Creating resource group..." -ForegroundColor Blue
    New-AzResourceGroup -Name $ResourceGroupName -Location $Location
    Write-Host "✅ Resource group created" -ForegroundColor Green
} else {
    Write-Host "✅ Resource group already exists" -ForegroundColor Green
}

# Deploy ARM template
Write-Host "🏗️ Deploying Azure resources..." -ForegroundColor Blue
$deployment = New-AzResourceGroupDeployment `
    -ResourceGroupName $ResourceGroupName `
    -TemplateFile "azure-config/azure-deploy.json" `
    -appName $AppName `
    -location $Location `
    -sku $Sku `
    -Verbose

if ($deployment.ProvisioningState -eq "Succeeded") {
    Write-Host "✅ Azure resources deployed successfully!" -ForegroundColor Green
    
    $webAppName = $deployment.Outputs.webAppName.Value
    $webAppUrl = $deployment.Outputs.webAppUrl.Value
    $stagingUrl = $deployment.Outputs.stagingUrl.Value
    
    Write-Host "📱 Web App Name: $webAppName" -ForegroundColor Yellow
    Write-Host "🌐 Production URL: $webAppUrl" -ForegroundColor Yellow  
    Write-Host "🔧 Staging URL: $stagingUrl" -ForegroundColor Yellow

    # Configure app settings
    Write-Host "⚙️ Configuring application settings..." -ForegroundColor Blue
    
    $appSettings = @{
        "NODE_ENV" = "production"
        "WEBSITES_ENABLE_APP_SERVICE_STORAGE" = "false"
        "SCM_DO_BUILD_DURING_DEPLOYMENT" = "false"
        "WEBSITE_NODE_DEFAULT_VERSION" = "18.x"
        "SHOPIFY_API_KEY" = "1c7a47abe69b8020f7ed37d3528e0552"
        "SHOPIFY_API_SECRET" = "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"
        "SHOPIFY_APP_URL" = $webAppUrl
        # Add placeholder values for other settings
        "SUPABASE_URL" = "https://your-project.supabase.co"
        "SUPABASE_ANON_KEY" = "your_anon_key"
        "SUPABASE_SERVICE_KEY" = "your_service_key"
        "OPENAI_API_KEY" = "sk-your_openai_key"
        "REDIS_URL" = "redis://localhost:6379"
        "JWT_SECRET" = "your_jwt_secret_here"
        "LOG_LEVEL" = "info"
    }
    
    # Apply settings to production slot
    Set-AzWebApp -ResourceGroupName $ResourceGroupName -Name $webAppName -AppSettings $appSettings
    
    # Apply similar settings to staging slot
    $stagingSettings = $appSettings.Clone()
    $stagingSettings["NODE_ENV"] = "staging"
    $stagingSettings["SHOPIFY_APP_URL"] = $stagingUrl
    
    Set-AzWebAppSlot -ResourceGroupName $ResourceGroupName -Name $webAppName -Slot "staging" -AppSettings $stagingSettings
    
    Write-Host "✅ Application settings configured" -ForegroundColor Green

    # Configure deployment source (GitHub)
    Write-Host "🔗 Configuring GitHub deployment..." -ForegroundColor Blue
    Write-Host "📝 Manual steps required:" -ForegroundColor Yellow
    Write-Host "1. Go to Azure Portal > $webAppName > Deployment Center" -ForegroundColor White
    Write-Host "2. Select 'GitHub Actions'" -ForegroundColor White  
    Write-Host "3. Connect your GitHub repository" -ForegroundColor White
    Write-Host "4. Select branch: main" -ForegroundColor White
    Write-Host "5. Azure will generate workflow file automatically" -ForegroundColor White

    # Output summary
    Write-Host "`n🎉 Deployment setup completed!" -ForegroundColor Green
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Update environment variables in Azure Portal with real values:" -ForegroundColor White
    Write-Host "   - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY" -ForegroundColor White
    Write-Host "   - OPENAI_API_KEY" -ForegroundColor White
    Write-Host "   - REDIS_URL (if using external Redis)" -ForegroundColor White
    Write-Host "2. Push code to GitHub main branch to trigger deployment" -ForegroundColor White
    Write-Host "3. Test the application at: $webAppUrl" -ForegroundColor White
    Write-Host "4. Update Shopify app settings with production URL" -ForegroundColor White
    
} else {
    Write-Host "❌ Deployment failed: $($deployment.ProvisioningState)" -ForegroundColor Red
    exit 1
}

Write-Host "`n📋 Resource Details:" -ForegroundColor Cyan
Write-Host "Resource Group: $ResourceGroupName"
Write-Host "Web App: $webAppName" 
Write-Host "Production URL: $webAppUrl"
Write-Host "Staging URL: $stagingUrl"