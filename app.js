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
  
  // First, let's inspect the file system structure
  console.log('🔍 File system inspection:');
  try {
    console.log('Working directory:', __dirname);
    console.log('Contents of root:', fs.readdirSync(__dirname).slice(0, 10));
    
    const backendPath = path.join(__dirname, 'backend');
    if (fs.existsSync(backendPath)) {
      console.log('Contents of backend/:', fs.readdirSync(backendPath).slice(0, 10));
      
      const distPath = path.join(backendPath, 'dist');
      if (fs.existsSync(distPath)) {
        console.log('Contents of backend/dist/:', fs.readdirSync(distPath).slice(0, 10));
        const indexPath = path.join(distPath, 'index.js');
        console.log('index.js exists:', fs.existsSync(indexPath));
        console.log('index.js size:', fs.existsSync(indexPath) ? fs.statSync(indexPath).size : 'N/A');
      }
    }
    
    // Check node_modules
    const nodeModulesPath = path.join(__dirname, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      console.log('Root node_modules exists, packages:', fs.readdirSync(nodeModulesPath).length);
      console.log('Express in root:', fs.existsSync(path.join(nodeModulesPath, 'express')));
    }
    
    const backendNodeModulesPath = path.join(__dirname, 'backend/node_modules');
    if (fs.existsSync(backendNodeModulesPath)) {
      console.log('Backend node_modules exists, packages:', fs.readdirSync(backendNodeModulesPath).length);
      console.log('Express in backend:', fs.existsSync(path.join(backendNodeModulesPath, 'express')));
    }
    
  } catch (inspectionError) {
    console.log('Error during inspection:', inspectionError.message);
  }
  
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
    
    // Try loading express first to debug
    console.log('🧪 Testing express resolution...');
    try {
      const expressPath = require.resolve('express');
      console.log('Express found at:', expressPath);
    } catch (expressError) {
      console.log('Express not found:', expressError.message);
    }
    
    // Change working directory to backend for relative imports
    const originalCwd = process.cwd();
    process.chdir(path.join(__dirname, 'backend'));
    
    console.log('📁 Changed working directory to:', process.cwd());
    
    // Check if index.js exists from current directory
    const indexJsPath = path.join(process.cwd(), 'dist', 'index.js');
    console.log('Index.js path from backend:', indexJsPath);
    console.log('Index.js exists from backend:', fs.existsSync(indexJsPath));
    
    // Load the compiled backend application
    console.log('📥 Attempting to require ./dist/index.js...');
    require('./dist/index.js');
    
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
        NODE_PATH: process.env.NODE_PATH,
        currentWorkingDir: process.cwd()
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