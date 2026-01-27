/**
 * Azure App Service Startup Script
 * This file is the entry point for Azure deployment
 */

const path = require('path');

// Set working directory to backend
process.chdir(path.join(__dirname, 'backend'));

// Load environment variables from config/.env if it exists
const dotenv = require('dotenv');
const envPath = path.join(__dirname, 'config', '.env');
const fs = require('fs');

if (fs.existsSync(envPath)) {
  console.log('Loading environment from:', envPath);
  dotenv.config({ path: envPath });
} else {
  console.log('No config/.env found, using Azure App Settings');
}

// Set default port for Azure
process.env.PORT = process.env.PORT || process.env.WEBSITES_PORT || '8080';

console.log('='.repeat(50));
console.log('Azure Startup Script');
console.log('='.repeat(50));
console.log('Working directory:', process.cwd());
console.log('Node version:', process.version);
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('='.repeat(50));

// Start the application
require(path.join(__dirname, 'backend', 'dist', 'index.js'));
