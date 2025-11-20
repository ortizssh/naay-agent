// Azure entry point - NO direct dependencies
console.log('🚀 Starting Naay Agent on Azure...');
console.log('📅 Deploy timestamp:', new Date().toISOString());
console.log('🔧 Environment:', process.env.NODE_ENV || 'development');
console.log('🌐 Port:', process.env.PORT || 8080);
console.log('📂 Working directory:', process.cwd());

// Create basic HTTP server first to avoid module errors
const http = require('http');
const fs = require('fs');
const path = require('path');
const port = process.env.PORT || 8080;

// Check if we have express available
let hasExpress = false;
try {
  require('express');
  hasExpress = true;
  console.log('✅ Express found, loading full application...');
  // Require startup only if express is available
  require('./startup.js');
} catch (error) {
  console.log('⚠️ Express not available, creating basic server for deployment...');
  
  // Create super basic server for deployment phase
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    
    const response = {
      success: false,
      message: '🔄 Naay Agent is deploying - dependencies installing...',
      status: 'DEPLOYING',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      port: port,
      hasExpress: hasExpress,
      deployment_id: Date.now(),
      files: {
        'package.json': fs.existsSync(path.join(__dirname, 'package.json')),
        'backend/package.json': fs.existsSync(path.join(__dirname, 'backend', 'package.json')),
        'node_modules': fs.existsSync(path.join(__dirname, 'node_modules')),
        'backend/node_modules': fs.existsSync(path.join(__dirname, 'backend', 'node_modules')),
        'backend/dist': fs.existsSync(path.join(__dirname, 'backend', 'dist')),
      },
      package_scripts: {
        postinstall: 'Configured to run azure:setup',
        azure_setup: 'Installs deps and builds backend'
      },
      message_details: 'Azure postinstall hook should run azure:setup. If this message persists, check Azure deployment logs.',
    };
    
    res.end(JSON.stringify(response, null, 2));
  });
  
  server.listen(port, () => {
    console.log(`🔄 Basic deployment server running on port ${port}`);
    console.log('🔄 Waiting for npm install to complete...');
  });
}