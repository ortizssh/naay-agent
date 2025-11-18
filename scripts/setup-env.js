const fs = require('fs');
const path = require('path');

const envExamplePath = path.join(__dirname, '../config/.env.example');
const envPath = path.join(__dirname, '../config/.env');

function setupEnvironment() {
  console.log('🔧 Setting up environment variables...');

  // Check if .env already exists
  if (fs.existsSync(envPath)) {
    console.log('✅ .env file already exists');
    return;
  }

  // Check if .env.example exists
  if (!fs.existsSync(envExamplePath)) {
    console.log('❌ .env.example file not found');
    return;
  }

  try {
    // Copy .env.example to .env
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ Created .env file from .env.example');
    console.log('');
    console.log('⚠️  IMPORTANT: Update the .env file with your actual credentials:');
    console.log('   - Shopify API keys from your Partner Dashboard');
    console.log('   - Supabase URL and keys from your project');
    console.log('   - OpenAI API key from your OpenAI account');
    console.log('   - Redis URL if using external Redis');
    console.log('');
    console.log('📁 Edit: config/.env');

  } catch (error) {
    console.error('❌ Error creating .env file:', error.message);
  }
}

if (require.main === module) {
  setupEnvironment();
}

module.exports = { setupEnvironment };