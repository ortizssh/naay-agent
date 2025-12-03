// Azure App Service startup file for Node.js applications
// This file handles the startup process for the Naay Agent backend

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Set production environment
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Disable Redis for Azure (no Redis service available by default)
process.env.REDIS_ENABLED = 'false';

// Set default port for Azure
const port = process.env.PORT || process.env.WEBSITES_PORT || 3000;
process.env.PORT = port;

console.log(`🚀 Starting Naay Agent Backend on port ${port}`);
console.log(`📱 Environment: ${process.env.NODE_ENV}`);

// Debug: Check Azure environment
console.log(`🔍 Azure Debug Info:`);
console.log(`- __dirname: ${__dirname}`);
console.log(`- process.cwd(): ${process.cwd()}`);
console.log(`- Available env vars: ${Object.keys(process.env).filter(k => k.includes('SHOPIFY') || k.includes('SUPABASE') || k.includes('OPENAI')).join(', ')}`);

// Path to the main application
const appPath = path.join(__dirname, '..', 'dist', 'index.js');

console.log(`📂 Application path: ${appPath}`);

// Verify the file exists
if (!fs.existsSync(appPath)) {
  console.error(`❌ Application file not found at: ${appPath}`);
  
  // Try alternative paths
  const altPaths = [
    path.join(__dirname, 'dist', 'index.js'),
    path.join(process.cwd(), 'dist', 'index.js'),
    path.join(process.cwd(), 'backend', 'dist', 'index.js')
  ];
  
  for (const altPath of altPaths) {
    console.log(`🔍 Checking alternative path: ${altPath}`);
    if (fs.existsSync(altPath)) {
      console.log(`✅ Found application at: ${altPath}`);
      break;
    }
  }
  
  // List contents of current directory for debugging
  try {
    const files = fs.readdirSync(__dirname);
    console.log(`📁 Contents of ${__dirname}:`, files);
    
    if (fs.existsSync(path.join(__dirname, '..'))) {
      const parentFiles = fs.readdirSync(path.join(__dirname, '..'));
      console.log(`📁 Contents of parent directory:`, parentFiles);
    }
  } catch (e) {
    console.error('Error listing directory contents:', e);
  }
  
  process.exit(1);
}

// Start the application
const app = spawn('node', [appPath], {
  stdio: 'inherit',
  env: process.env
});

app.on('error', (error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});

app.on('exit', (code, signal) => {
  console.log(`Application exited with code ${code} and signal ${signal}`);
  if (code !== 0) {
    process.exit(code);
  }
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  app.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  app.kill('SIGINT');
});