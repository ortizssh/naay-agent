#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Naay Agent - Complete Conversion Tracking Setup');
console.log('=================================================');
console.log('');

async function completeSetup() {
  try {
    // Step 1: Check if backend is compiled
    console.log('1️⃣  Checking backend compilation...');
    const distPath = path.join(__dirname, '..', 'backend', 'dist');
    
    if (!fs.existsSync(distPath)) {
      console.log('   Building backend...');
      execSync('npm run build', { 
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit' 
      });
    } else {
      console.log('   ✅ Backend already compiled');
    }
    console.log('');

    // Step 2: Check database setup
    console.log('2️⃣  Database setup required');
    console.log('   📋 Please execute the SQL from: scripts/setup-simple-conversions-manual.md');
    console.log('   📍 Go to your Supabase project → SQL Editor');
    console.log('   📝 Run each statement from the manual setup file');
    console.log('');
    console.log('   Press Enter when database setup is complete...');
    
    // Wait for user confirmation
    await waitForEnter();
    console.log('');

    // Step 3: Check for existing data
    console.log('3️⃣  Checking for historical data...');
    
    // We'll create a simple status check
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );

      // Check for existing recommendations
      const { data: recData, error: recError } = await supabase
        .from('ai_recommendation_events')
        .select('shop_domain')
        .limit(1);

      if (recError) {
        console.log('   ⚠️  Could not check historical recommendations:', recError.message);
      } else if (recData && recData.length > 0) {
        console.log('   ✅ Historical recommendations found');
        
        // Get unique shops
        const { data: shops } = await supabase
          .from('ai_recommendation_events')
          .select('shop_domain')
          .group('shop_domain');
        
        console.log(`   📊 Found data for ${shops?.length || 'unknown'} shops`);
        console.log('');
        
        // Ask if they want to migrate
        console.log('4️⃣  Historical Data Migration');
        console.log('   Found existing recommendation data. Do you want to:');
        console.log('   a) Preview migration (dry run)');
        console.log('   b) Execute full migration');
        console.log('   c) Skip migration for now');
        console.log('');
        
        const choice = await askChoice(['a', 'b', 'c']);
        
        if (choice === 'a' || choice === 'b') {
          const dryRun = choice === 'a';
          const mode = dryRun ? 'preview' : 'execute';
          
          console.log(`   Running migration in ${mode} mode...`);
          
          try {
            const migrationScript = path.join(__dirname, 'migrate-historical-conversions.js');
            const command = `node "${migrationScript}" --days 30 ${!dryRun ? '--execute' : ''}`;
            
            execSync(command, { stdio: 'inherit' });
            
            if (dryRun) {
              console.log('');
              console.log('   💡 Run the script again with --execute flag to save the conversions');
            }
          } catch (migrationError) {
            console.log('   ⚠️  Migration script needs compilation. Run manually:');
            console.log(`   node scripts/migrate-historical-conversions.js --days 30 ${!dryRun ? '--execute' : ''}`);
          }
        }
      } else {
        console.log('   ℹ️  No historical recommendations found - fresh start');
      }
    } catch (dbError) {
      console.log('   ⚠️  Could not check database:', dbError.message);
    }
    console.log('');

    // Step 4: Verify webhooks
    console.log('5️⃣  Shopify Webhook Configuration');
    console.log('   🔗 Your shopify.app.toml has been updated with order webhooks');
    console.log('   📋 Next steps:');
    console.log('   1. Deploy your app: npm run deploy');
    console.log('   2. Update Shopify webhooks: npm run shopify:deploy');
    console.log('   3. Verify in Shopify Partner Dashboard → Apps → Your App → App setup');
    console.log('');

    // Step 5: Testing
    console.log('6️⃣  Testing & Monitoring');
    console.log('   🧪 Test endpoints:');
    console.log('   - GET /api/simple-conversions/dashboard?shop=your-shop.myshopify.com');
    console.log('   - GET /api/migration/status?shop=your-shop.myshopify.com');
    console.log('   - POST /api/simple-conversions/test-recommendation');
    console.log('');
    console.log('   📊 Monitor logs for:');
    console.log('   - "Simple recommendations tracked" when AI makes recommendations');
    console.log('   - "Simple conversions detected!" when orders come in via webhooks');
    console.log('');

    console.log('✅ Setup Complete!');
    console.log('==================');
    console.log('');
    console.log('🎯 The system will now:');
    console.log('   • Track AI recommendations automatically');
    console.log('   • Detect conversions within 10 minutes via order webhooks');
    console.log('   • Provide conversion analytics via dashboard');
    console.log('');
    console.log('📈 Key URLs:');
    console.log('   • Dashboard: /api/simple-conversions/dashboard');
    console.log('   • Analytics: /api/simple-conversions/stats');
    console.log('   • Migration: /api/migration/status');
    console.log('');
    console.log('🔍 Troubleshooting:');
    console.log('   • Check webhook delivery in Shopify Partner Dashboard');
    console.log('   • Monitor application logs for conversion detection');
    console.log('   • Use test endpoints to verify system functionality');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error('');
    console.error('🛠️  Manual steps:');
    console.error('1. Run: npm run build');
    console.error('2. Execute SQL from: scripts/setup-simple-conversions-manual.md');
    console.error('3. Deploy app and update webhooks');
    console.error('4. Test with dashboard endpoints');
    process.exit(1);
  }
}

function waitForEnter() {
  return new Promise((resolve) => {
    process.stdin.once('data', () => {
      resolve();
    });
  });
}

function askChoice(validChoices) {
  return new Promise((resolve) => {
    process.stdout.write(`   Enter choice (${validChoices.join('/')}) [a]: `);
    process.stdin.once('data', (data) => {
      const choice = data.toString().trim().toLowerCase() || 'a';
      if (validChoices.includes(choice)) {
        resolve(choice);
      } else {
        console.log('   Invalid choice, using default: a');
        resolve('a');
      }
    });
  });
}

// Handle direct execution
if (require.main === module) {
  completeSetup().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = completeSetup;