// Azure startup file - Entry point for Node.js app
console.log('🚀 Starting Naay Agent on Azure...');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Port:', process.env.PORT || 8080);

// Check if dist folder exists, otherwise use fallback
const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, 'backend', 'dist', 'index.js');
const fallbackPath = path.join(__dirname, 'test-deploy', 'index.js');

// Check for dependencies first
function checkDependencies() {
  try {
    require('express');
    console.log('✅ Express dependency found');
    return true;
  } catch (error) {
    console.log('❌ Express dependency not found:', error.message);
    return false;
  }
}

// Check if we're in Azure environment
function isAzureEnvironment() {
  return process.env.WEBSITE_SITE_NAME || process.env.APPSETTING_WEBSITE_SITE_NAME;
}

const hasDependencies = checkDependencies();
const isAzure = isAzureEnvironment();

console.log(`🌐 Azure environment: ${isAzure ? 'Yes' : 'No'}`);
console.log(`📦 Dependencies available: ${hasDependencies ? 'Yes' : 'No'}`);

console.log(`📍 Current working directory: ${__dirname}`);
console.log(`📍 Dist path: ${distPath}`);
console.log(`📍 Fallback path: ${fallbackPath}`);
console.log(`📊 Dist exists: ${fs.existsSync(distPath)}`);
console.log(`📊 Fallback exists: ${fs.existsSync(fallbackPath)}`);

if (fs.existsSync(distPath) && hasDependencies) {
  console.log('✅ Loading main application from backend/dist/index.js');
  try {
    require('./backend/dist/index.js');
  } catch (error) {
    console.error('❌ Failed to load main application:', error.message);
    console.log('🔄 Falling back to basic server...');
    createFallbackServer();
  }
} else if (fs.existsSync(fallbackPath) && hasDependencies) {
  console.log('⚠️ Main app not found, loading test deployment from test-deploy/index.js');
  try {
    require('./test-deploy/index.js');
  } catch (error) {
    console.error('❌ Failed to load fallback application:', error.message);
    console.log('🔄 Creating basic server...');
    createFallbackServer();
  }
} else {
  console.log('❌ Dependencies not available or application not found, creating basic server...');
  createFallbackServer();
}

function createFallbackServer() {
  // Create super basic HTTP server without dependencies
  const http = require('http');
  const port = process.env.PORT || 8080;
  
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    
    const response = {
      success: false,
      message: hasDependencies ? 
        '⚠️ Naay Agent deployment incomplete - main app not found' :
        '⚠️ Dependencies not installed - npm install in progress',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      port: port,
      azure: isAzure,
      files_found: {
        'backend/dist/index.js': fs.existsSync(distPath),
        'test-deploy/index.js': fs.existsSync(fallbackPath),
        'package.json': fs.existsSync(path.join(__dirname, 'package.json')),
        'backend/node_modules': fs.existsSync(path.join(__dirname, 'backend', 'node_modules')),
        'node_modules': fs.existsSync(path.join(__dirname, 'node_modules')),
        'dependencies': hasDependencies
      },
      next_steps: hasDependencies ? [
        'Check dist/index.js compilation',
        'Verify environment variables'
      ] : [
        'Wait for Azure npm install to complete',
        'App will restart automatically when ready'
      ]
    };
    
    res.end(JSON.stringify(response, null, 2));
  });
  
  server.listen(port, () => {
    console.log(`🔄 Fallback HTTP server running on port ${port}`);
    console.log(`Dependencies available: ${hasDependencies}`);
    console.log(`Files found: dist=${fs.existsSync(distPath)}, fallback=${fs.existsSync(fallbackPath)}`);
  });
}