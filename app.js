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
    // Try multiple possible locations for dependencies
    const locations = [
      'express',
      './node_modules/express',
      './backend/node_modules/express',
    ];
    
    let foundExpress = false;
    for (const location of locations) {
      try {
        require.resolve(location);
        foundExpress = true;
        break;
      } catch (e) {
        // Continue trying other locations
      }
    }
    
    if (!foundExpress) {
      console.log('❌ Express not found in any location');
      return false;
    }

    // Check if basic Node.js modules work (simpler test)
    require('fs');
    require('path');
    require('http');
    
    console.log('✅ Core dependencies found');
    return true;
  } catch (error) {
    console.log('❌ Core dependencies missing:', error.message);
    
    // Debug info
    console.log('Available modules in current directory:');
    try {
      const fs = require('fs');
      if (fs.existsSync('./node_modules')) {
        console.log('- node_modules exists at root');
        const modules = fs.readdirSync('./node_modules');
        console.log(`- Found ${modules.length} modules:`, modules.slice(0, 10));
      } else {
        console.log('- No node_modules at root');
      }
      
      if (fs.existsSync('./backend/node_modules')) {
        console.log('- backend/node_modules exists');
        const backendModules = fs.readdirSync('./backend/node_modules');
        console.log(`- Found ${backendModules.length} backend modules:`, backendModules.slice(0, 10));
      } else {
        console.log('- No backend/node_modules');
      }
    } catch (debugError) {
      console.log('Error during debug:', debugError.message);
    }
    
    return false;
  }
}

const hasDependencies = checkDependencies();

if (distExists) {
  console.log('✅ Loading full Naay Agent application from backend/dist/index.js');
  try {
    // Set production environment
    process.env.NODE_ENV = process.env.NODE_ENV || 'production';
    
    // Fix NODE_PATH to include root node_modules for compiled backend
    const originalNodePath = process.env.NODE_PATH || '';
    const rootNodeModules = path.join(__dirname, 'node_modules');
    const backendNodeModules = path.join(__dirname, 'backend/node_modules');
    
    process.env.NODE_PATH = [rootNodeModules, backendNodeModules, originalNodePath]
      .filter(p => p)
      .join(path.delimiter);
    
    // Refresh module cache to pick up new NODE_PATH
    require('module').Module._initPaths();
    
    console.log('🔧 NODE_PATH configured:', process.env.NODE_PATH);
    
    // Change working directory to backend for relative imports
    const originalCwd = process.cwd();
    process.chdir(path.join(__dirname, 'backend'));
    
    console.log('📁 Changed working directory to:', process.cwd());
    
    // Load the compiled backend application
    require('../dist/index.js');
    
    console.log('✅ Naay Agent application loaded successfully!');
    
  } catch (error) {
    console.error('❌ Failed to load main application:', error.message);
    console.error('Error stack:', error.stack);
    
    // Restore original working directory
    try {
      process.chdir(__dirname);
    } catch (e) {}
    
    // If it's a dependency error, give more info
    if (error.code === 'MODULE_NOT_FOUND') {
      console.log('🔍 Module not found details:', {
        module: error.message,
        paths: error.paths ? error.paths.slice(0, 5) : 'none',
        NODE_PATH: process.env.NODE_PATH
      });
    }
    
    console.log('🔄 Falling back to basic server...');
    createFallbackServer();
  }
} else {
  console.log('❌ Application not ready - backend/dist/index.js not found');
  console.log(`Working directory: ${__dirname}`);
  console.log(`Expected at: ${distPath}`);
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