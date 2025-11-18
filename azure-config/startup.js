// Azure App Service startup file for Node.js applications
// This file handles the startup process for the Naay Agent backend

const { spawn } = require('child_process');
const path = require('path');

// Set production environment
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Set default port for Azure
const port = process.env.PORT || process.env.WEBSITES_PORT || 3000;
process.env.PORT = port;

console.log(`Starting Naay Agent Backend on port ${port}`);
console.log(`Environment: ${process.env.NODE_ENV}`);

// Path to the main application
const appPath = path.join(__dirname, '..', 'dist', 'index.js');

console.log(`Starting application at: ${appPath}`);

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