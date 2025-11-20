// Azure production entry point for Naay Agent
console.log('🚀 Naay Agent - Azure Production Server starting...');
console.log('Environment:', process.env.NODE_ENV || 'production');
console.log('Port:', process.env.PORT || 8080);
console.log('Deploy time:', new Date().toISOString());

// Check if dist folder exists and dependencies are available
const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, 'backend', 'dist', 'index.js');
const distExists = fs.existsSync(distPath);

console.log(`📍 Dist path: ${distPath}`);
console.log(`📊 Dist exists: ${distExists}`);

// Check for key dependencies
function checkDependencies() {
  try {
    require.resolve('express');
    require.resolve('@supabase/supabase-js');
    require.resolve('openai');
    console.log('✅ Core dependencies found');
    return true;
  } catch (error) {
    console.log('❌ Core dependencies missing:', error.message);
    return false;
  }
}

const hasDependencies = checkDependencies();

if (distExists && hasDependencies) {
  console.log('✅ Loading full Naay Agent application from backend/dist/index.js');
  try {
    // Set production environment
    process.env.NODE_ENV = process.env.NODE_ENV || 'production';
    
    // Load the compiled backend application
    require('./backend/dist/index.js');
    
  } catch (error) {
    console.error('❌ Failed to load main application:', error.message);
    console.error('Error stack:', error.stack);
    console.log('🔄 Falling back to basic server...');
    createFallbackServer();
  }
} else {
  console.log('❌ Application not ready - missing dist or dependencies');
  console.log(`Dist exists: ${distExists}, Dependencies: ${hasDependencies}`);
  createFallbackServer();
}

function createFallbackServer() {
  const http = require('http');
  const port = process.env.PORT || 8080;
  
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    
    if (req.method === 'OPTIONS') {
      res.end();
      return;
    }
    
    const response = {
      status: 'fallback_mode',
      message: 'Naay Agent - Fallback server active',
      reason: distExists ? 'dependencies_missing' : 'build_not_found',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production',
      port: port,
      version: '1.0.0',
      files_found: {
        'backend/dist/index.js': distExists,
        'dependencies_available': hasDependencies,
        'working_directory': __dirname
      },
      next_steps: [
        'Check if npm install completed successfully',
        'Verify TypeScript compilation finished',
        'Review Azure deployment logs for errors'
      ]
    };
    
    res.end(JSON.stringify(response, null, 2));
  });
  
  server.listen(port, () => {
    console.log(`🔄 Fallback HTTP server running on port ${port}`);
    console.log(`Reason: ${distExists ? 'Dependencies missing' : 'Build not found'}`);
  });
}