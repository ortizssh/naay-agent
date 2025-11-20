// Simple Azure entry point - only Node.js built-ins
const http = require('http');
const port = process.env.PORT || 8080;

console.log('🚀 Naay Agent starting on port', port);

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
    status: 'online',
    message: 'Naay Agent is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    port: port,
    version: '1.0.0'
  };
  
  res.end(JSON.stringify(response, null, 2));
});

server.listen(port, () => {
  console.log(`✅ Naay Agent running on port ${port}`);
});