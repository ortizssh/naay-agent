#!/usr/bin/env node

/**
 * Test Conversion Analytics System
 * 
 * This script tests the conversion analytics system to ensure it works correctly
 * 
 * Usage: node scripts/test-conversion-system.js [shop-domain]
 */

const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });

console.log('🧪 Testing Conversion Analytics System');
console.log('=====================================');

const shopDomain = process.argv[2] || 'naay.cl';

async function testSystem() {
  try {
    // Import Supabase service
    const { SupabaseService } = await import('../backend/dist/services/supabase.service.js');
    const supabaseService = new SupabaseService();
    
    console.log(`\n🏪 Testing with shop: ${shopDomain}`);
    
    // Test 1: Check if shop exists
    console.log('\n📋 Test 1: Checking shop exists...');
    const store = await supabaseService.getStore(shopDomain);
    if (!store) {
      console.log(`❌ Shop "${shopDomain}" not found in database`);
      
      // Show available shops
      const { data: shops } = await supabaseService.client
        .from('stores')
        .select('shop_domain')
        .limit(5);
      
      if (shops && shops.length > 0) {
        console.log('\n💡 Available shops:');
        shops.forEach(shop => console.log(`   - ${shop.shop_domain}`));
        console.log('\nTry: node scripts/test-conversion-system.js [shop-domain]');
      }
      return;
    }
    console.log(`✅ Shop found: ${store.shop_domain}`);
    
    // Test 2: Check recommendations data
    console.log('\n📋 Test 2: Checking recommendations data...');
    const { data: recommendations, error: recError } = await supabaseService.client
      .from('simple_recommendations')
      .select('id, product_title, recommended_at')
      .eq('shop_domain', shopDomain)
      .order('recommended_at', { ascending: false })
      .limit(5);
    
    if (recError) {
      console.log('❌ Error fetching recommendations:', recError.message);
      return;
    }
    
    console.log(`✅ Found ${recommendations?.length || 0} recent recommendations`);
    if (recommendations && recommendations.length > 0) {
      console.log('📦 Sample recommendations:');
      recommendations.forEach((rec, i) => {
        const date = new Date(rec.recommended_at).toLocaleDateString();
        console.log(`   ${i + 1}. ${rec.product_title} (${date})`);
      });
    }
    
    // Test 3: Check conversions data
    console.log('\n📋 Test 3: Checking conversions data...');
    const { data: conversions, error: convError } = await supabaseService.client
      .from('simple_conversions')
      .select('id, order_amount, purchased_at, minutes_to_conversion')
      .eq('shop_domain', shopDomain)
      .order('purchased_at', { ascending: false })
      .limit(5);
    
    if (convError) {
      console.log('❌ Error fetching conversions:', convError.message);
      return;
    }
    
    console.log(`✅ Found ${conversions?.length || 0} conversions`);
    if (conversions && conversions.length > 0) {
      console.log('💰 Sample conversions:');
      conversions.forEach((conv, i) => {
        const date = new Date(conv.purchased_at).toLocaleDateString();
        const amount = parseFloat(conv.order_amount || 0).toFixed(2);
        const time = conv.minutes_to_conversion || 0;
        console.log(`   ${i + 1}. $${amount} - ${time}min (${date})`);
      });
    }
    
    // Test 4: Test SQL functions if available
    console.log('\n📋 Test 4: Testing SQL functions...');
    try {
      const { data: stats, error: statsError } = await supabaseService.client
        .rpc('get_simple_conversion_stats', {
          p_shop_domain: shopDomain,
          p_days_back: 30
        });
      
      if (statsError) {
        console.log('⚠️  SQL function not available (run the SQL file first):', statsError.message);
      } else if (stats && stats.length > 0) {
        const stat = stats[0];
        console.log('✅ SQL functions working!');
        console.log('📊 Conversion Stats (30 days):');
        console.log(`   📈 Recommendations: ${stat.total_recommendations}`);
        console.log(`   💰 Conversions: ${stat.total_conversions}`);
        console.log(`   📊 Rate: ${stat.conversion_rate}%`);
        console.log(`   💵 Revenue: $${stat.total_revenue}`);
        console.log(`   ⏱️  Avg Time: ${stat.avg_time_to_conversion} minutes`);
      }
    } catch (sqlError) {
      console.log('⚠️  SQL functions not installed yet');
    }
    
    // Test 5: Test API endpoints
    console.log('\n📋 Test 5: Testing API endpoint...');
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`http://localhost:3000/api/admin-bypass/conversions/summary?shop=${shopDomain}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API endpoint working!');
        console.log('📋 API Response Summary:');
        console.log(`   📈 Total Recommendations: ${data.data?.overall?.totalRecommendations || 0}`);
        console.log(`   💰 Total Conversions: ${data.data?.overall?.totalConversions || 0}`);
        console.log(`   📊 Rate: ${data.data?.overall?.conversionRate || 0}%`);
        console.log(`   💵 Revenue: $${data.data?.overall?.totalRevenue || 0}`);
      } else {
        console.log('⚠️  API endpoint not responding (is server running?)');
      }
    } catch (apiError) {
      console.log('⚠️  Could not test API endpoint (server may not be running)');
    }
    
    // Summary
    console.log('\n🎯 System Status Summary:');
    console.log('========================');
    
    const totalRecommendations = recommendations?.length || 0;
    const totalConversions = conversions?.length || 0;
    
    if (totalRecommendations === 0) {
      console.log('📝 Status: Recommendations table empty');
      console.log('💡 Action: Run backfill script to extract historical recommendations from chat');
      console.log('   Command: node scripts/backfill-historical-conversions.js ' + shopDomain + ' --backfill-only');
    } else if (totalConversions === 0) {
      console.log('📝 Status: Recommendations found, but no conversions yet');
      console.log('💡 Action: Process Shopify orders to create conversions');
      console.log('   Command: node scripts/backfill-historical-conversions.js ' + shopDomain + ' --conversions-only');
    } else {
      console.log('📝 Status: System working! ✅');
      console.log('💡 Action: You can now view your conversion dashboard');
      console.log(`   Dashboard: http://localhost:3000/api/admin-bypass/conversions/dashboard?shop=${shopDomain}`);
    }
    
    console.log('\n🔗 Available Endpoints:');
    console.log(`   📊 Dashboard: GET /api/admin-bypass/conversions/dashboard?shop=${shopDomain}`);
    console.log(`   📋 Summary: GET /api/admin-bypass/conversions/summary?shop=${shopDomain}`);
    console.log(`   🏆 Top Products: GET /api/admin-bypass/conversions/top-products?shop=${shopDomain}`);
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('MODULE_NOT_FOUND')) {
      console.log('💡 Try building the backend first: cd backend && npm run build');
    }
    
    process.exit(1);
  }
}

// Run the test
testSystem().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});