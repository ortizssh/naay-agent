// URGENT FIX - Azure deployment with unique name
const http = require('http');
const port = process.env.PORT || 8080;

console.log('🔥 URGENT FIX - Naay Agent starting on port', port);
console.log('🕒 Deploy time:', new Date().toISOString());

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
    status: 'URGENT_FIX_ACTIVE',
    message: 'Naay Agent - URGENT FIX deployed successfully!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    port: port,
    version: '1.0.0-URGENT',
    deployment_id: Date.now(),
    fix_applied: true
  };
  
  res.end(JSON.stringify(response, null, 2));
});

server.listen(port, () => {
  console.log(`🔥 URGENT FIX - Naay Agent running on port ${port}`);
  console.log('✅ No dependencies required - using only Node.js built-ins');
});