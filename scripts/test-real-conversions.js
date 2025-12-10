#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config', '.env') });

async function testRealConversions() {
  console.log('🔍 Testing Real Conversion Analysis');
  console.log('==================================');
  
  try {
    // Import the service
    const { RealConversionAnalyzer } = require('../backend/dist/services/real-conversion-analyzer.service.js');
    const analyzer = new RealConversionAnalyzer();
    
    const shopDomain = 'naay-cosmetics.myshopify.com';
    const daysBack = 7;
    
    console.log(`Shop: ${shopDomain}`);
    console.log(`Analysis Period: Last ${daysBack} days`);
    console.log('');
    
    console.log('🚀 Starting real conversion analysis...');
    const startTime = Date.now();
    
    // Run analysis without saving (test mode)
    const result = await analyzer.analyzeRealConversions(
      shopDomain,
      daysBack,
      false // Don't save results, just test
    );
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Analysis completed in ${(duration / 1000).toFixed(2)}s`);
    console.log('');
    
    // Display results
    console.log('📊 Analysis Results:');
    console.log('===================');
    console.log(`Orders from Shopify API: ${result.ordersAnalyzed}`);
    console.log(`Conversions Detected: ${result.conversionsFound}`);
    console.log(`Total Revenue: €${result.totalRevenue.toFixed(2)}`);
    console.log(`Conversion Rate: ${result.summary.conversionRate.toFixed(2)}%`);
    console.log(`Avg Time to Convert: ${result.summary.averageMinutesToConversion.toFixed(1)} minutes`);
    console.log(`Avg Order Value: €${result.summary.averageOrderValue.toFixed(2)}`);
    console.log('');
    
    if (result.summary.topProducts.length > 0) {
      console.log('🏆 Top Converting Products:');
      result.summary.topProducts.forEach((product, index) => {
        console.log(`  ${index + 1}. ${product.productTitle}`);
        console.log(`     Conversions: ${product.conversions}, Revenue: €${product.revenue.toFixed(2)}`);
      });
      console.log('');
    }
    
    if (result.conversions.length > 0) {
      console.log('💰 Recent Conversions (first 5):');
      result.conversions.slice(0, 5).forEach((conv, index) => {
        console.log(`  ${index + 1}. ${conv.productTitle}`);
        console.log(`     Session: ${conv.sessionId.substring(0, 12)}...`);
        console.log(`     Order: ${conv.orderName}`);
        console.log(`     Time to convert: ${conv.minutesToConversion} minutes`);
        console.log(`     Confidence: ${(conv.confidence * 100).toFixed(0)}%`);
        console.log(`     Amount: €${conv.orderAmount.toFixed(2)}`);
        console.log(`     Purchased: ${conv.purchasedAt}`);
        console.log('');
      });
    } else {
      console.log('ℹ️  No real conversions detected in this period');
      console.log('');
      console.log('💡 This could mean:');
      console.log('   • No orders were placed during the analysis period');
      console.log('   • Orders don\'t match AI-recommended products');
      console.log('   • Orders occurred outside the 10-minute attribution window');
      console.log('   • Product matching logic needs refinement');
    }
    
    // Test analytics comparison
    console.log('📈 Testing Analytics Comparison...');
    const analytics = await analyzer.getRealConversionAnalytics(shopDomain, daysBack);
    
    console.log('Analytics Summary:');
    console.log(`  Real Conversions: ${analytics.realConversions}`);
    console.log(`  Simulated Conversions: ${analytics.simulatedConversions}`);
    console.log(`  Total Revenue: €${analytics.totalRevenue.toFixed(2)}`);
    console.log(`  Real vs Simulated Ratio: ${analytics.realVsSimulatedRatio.toFixed(2)}`);
    console.log(`  Model Accuracy: ${analytics.accuracy.toFixed(1)}%`);
    console.log('');
    
    // Recommendations based on results
    console.log('🎯 Recommendations:');
    if (result.ordersAnalyzed === 0) {
      console.log('   • Verify Shopify API access and store connection');
      console.log('   • Check if orders exist in the specified time period');
    } else if (result.conversionsFound === 0) {
      console.log('   • Consider extending attribution window beyond 10 minutes');
      console.log('   • Review product matching algorithm for accuracy');
      console.log('   • Ensure AI recommendations are using correct product IDs');
    } else {
      console.log(`   • ${result.summary.conversionRate.toFixed(1)}% conversion rate detected from real data`);
      if (result.summary.conversionRate > 5) {
        console.log('   • High conversion rate indicates effective AI recommendations');
      } else {
        console.log('   • Consider improving recommendation quality or timing');
      }
    }
    
    console.log('');
    console.log('✅ Real conversion analysis test completed!');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('   1. If results look good, run with saveResults=true');
    console.log('   2. Set up automated daily analysis');
    console.log('   3. Monitor real vs simulated conversion accuracy');
    console.log('   4. Optimize attribution window and product matching');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('');
    console.error('🔧 Troubleshooting:');
    console.error('   • Ensure backend is compiled: npm run build');
    console.error('   • Check database connection and tables exist');
    console.error('   • Verify Shopify store access token is valid');
    console.error('   • Check that recommendations exist in the database');
    console.error('');
    console.error('Full error:', error);
  }
}

// Handle direct execution
if (require.main === module) {
  testRealConversions().catch(console.error);
}

module.exports = testRealConversions;