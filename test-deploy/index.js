// Test deployment for Naay Agent Azure Web App
const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

// Basic middleware
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Naay Agent Backend is running on Azure!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    shopify: {
      api_key_configured: !!process.env.SHOPIFY_API_KEY,
      app_url: process.env.SHOPIFY_APP_URL
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Test API endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Test API endpoint working!',
    environment_variables: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY ? 'Configured' : 'Not configured',
      SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL
    }
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Naay Agent test server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Shopify API Key: ${process.env.SHOPIFY_API_KEY ? 'Configured' : 'Not configured'}`);
});

module.exports = app;