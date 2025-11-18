// Azure startup file - Entry point for Node.js app
console.log('🚀 Starting Naay Agent on Azure...');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Port:', process.env.PORT || 8080);

// Check if dist folder exists, otherwise use fallback
const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, 'dist', 'index.js');
const fallbackPath = path.join(__dirname, 'test-deploy', 'index.js');

if (fs.existsSync(distPath)) {
  console.log('✅ Loading main application from dist/index.js');
  require('./dist/index.js');
} else if (fs.existsSync(fallbackPath)) {
  console.log('⚠️ Main app not found, loading test deployment from test-deploy/index.js');
  require('./test-deploy/index.js');
} else {
  console.log('❌ No application found, creating basic server...');
  
  // Create basic Express server as fallback
  const express = require('express');
  const app = express();
  const port = process.env.PORT || 8080;
  
  app.use(express.json());
  
  app.get('/', (req, res) => {
    res.json({
      success: false,
      message: '⚠️ Naay Agent deployment incomplete - main app not found',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      available_endpoints: {
        health: '/health',
        status: '/status'
      },
      next_steps: [
        'Deploy the backend build to Azure',
        'Ensure dist/index.js exists',
        'Configure environment variables'
      ]
    });
  });
  
  app.get('/health', (req, res) => {
    res.json({
      status: 'degraded',
      message: 'Startup script running - main app not deployed',
      timestamp: new Date().toISOString()
    });
  });
  
  app.get('/status', (req, res) => {
    res.json({
      status: 'waiting_for_deployment',
      files_found: {
        'dist/index.js': fs.existsSync(distPath),
        'test-deploy/index.js': fs.existsSync(fallbackPath),
        'package.json': fs.existsSync(path.join(__dirname, 'package.json'))
      },
      environment_variables: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        SHOPIFY_API_KEY: !!process.env.SHOPIFY_API_KEY
      }
    });
  });
  
  app.listen(port, () => {
    console.log(`🔄 Fallback server running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}