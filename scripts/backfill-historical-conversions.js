#!/usr/bin/env node

/**
 * Enhanced Historical Conversion Backfill Script
 * 
 * This script works with your existing simple_recommendations table to:
 * 1. Backfill missing historical recommendations from chat messages
 * 2. Process Shopify orders to create historical conversions
 * 3. Generate comprehensive conversion analytics
 * 
 * Usage:
 * node scripts/backfill-historical-conversions.js [shop-domain] [options]
 * 
 * Options:
 * --from-date YYYY-MM-DD  Start date for analysis
 * --to-date YYYY-MM-DD    End date for analysis  
 * --dry-run              Show results without saving to database
 * --verbose              Show detailed progress information
 * --force                Overwrite existing conversion data
 * --backfill-only        Only backfill recommendations, don't process conversions
 * --conversions-only     Only process conversions, don't backfill recommendations
 * 
 * Examples:
 * node scripts/backfill-historical-conversions.js naay.cl
 * node scripts/backfill-historical-conversions.js naay.cl --from-date 2024-01-01 --verbose
 * node scripts/backfill-historical-conversions.js naay.cl --dry-run
 * node scripts/backfill-historical-conversions.js naay.cl --backfill-only
 */

const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });

console.log('🚀 Starting Enhanced Historical Conversion Backfill');
console.log('📊 Working with existing simple_recommendations table structure');
console.log('');

// Parse command line arguments
const args = process.argv.slice(2);
const shopDomain = args[0];

if (!shopDomain) {
  console.error('❌ Error: Shop domain is required');
  console.log('');
  console.log('Usage: node scripts/backfill-historical-conversions.js [shop-domain] [options]');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/backfill-historical-conversions.js naay.cl');
  console.log('  node scripts/backfill-historical-conversions.js naay.cl --from-date 2024-01-01');
  console.log('  node scripts/backfill-historical-conversions.js naay.cl --dry-run --verbose');
  process.exit(1);
}

// Parse options
const options = {
  fromDate: null,
  toDate: null,
  dryRun: args.includes('--dry-run'),
  verbose: args.includes('--verbose'),
  force: args.includes('--force'),
  backfillOnly: args.includes('--backfill-only'),
  conversionsOnly: args.includes('--conversions-only'),
};

// Parse date arguments
const fromDateIndex = args.indexOf('--from-date');
if (fromDateIndex >= 0 && args[fromDateIndex + 1]) {
  options.fromDate = new Date(args[fromDateIndex + 1]);
  if (isNaN(options.fromDate.getTime())) {
    console.error('❌ Error: Invalid --from-date format. Use YYYY-MM-DD');
    process.exit(1);
  }
}

const toDateIndex = args.indexOf('--to-date');
if (toDateIndex >= 0 && args[toDateIndex + 1]) {
  options.toDate = new Date(args[toDateIndex + 1]);
  if (isNaN(options.toDate.getTime())) {
    console.error('❌ Error: Invalid --to-date format. Use YYYY-MM-DD');
    process.exit(1);
  }
}

console.log('⚙️  Configuration:');
console.log(`   Shop: ${shopDomain}`);
console.log(`   From Date: ${options.fromDate ? options.fromDate.toISOString().split('T')[0] : 'All time'}`);
console.log(`   To Date: ${options.toDate ? options.toDate.toISOString().split('T')[0] : 'All time'}`);
console.log(`   Dry Run: ${options.dryRun ? 'Yes' : 'No'}`);
console.log(`   Verbose: ${options.verbose ? 'Yes' : 'No'}`);
console.log(`   Force Overwrite: ${options.force ? 'Yes' : 'No'}`);
console.log(`   Backfill Only: ${options.backfillOnly ? 'Yes' : 'No'}`);
console.log(`   Conversions Only: ${options.conversionsOnly ? 'Yes' : 'No'}`);
console.log('');

// Dynamic import for ES modules
async function main() {
  let EnhancedConversionAnalyticsService, SupabaseService;
  
  try {
    // Try to import the enhanced service
    try {
      const enhancedModule = await import('../backend/dist/services/enhanced-conversion-analytics.service.js');
      EnhancedConversionAnalyticsService = enhancedModule.EnhancedConversionAnalyticsService;
    } catch (importError) {
      console.log('⚠️  Enhanced service not found, building first...');
      
      // Try to build the backend first
      const { exec } = require('child_process');
      await new Promise((resolve, reject) => {
        exec('cd backend && npm run build', (error, stdout, stderr) => {
          if (error) {
            console.error('❌ Build failed:', error.message);
            reject(error);
            return;
          }
          console.log('✅ Backend built successfully');
          resolve(stdout);
        });
      });
      
      // Try import again
      const enhancedModule = await import('../backend/dist/services/enhanced-conversion-analytics.service.js');
      EnhancedConversionAnalyticsService = enhancedModule.EnhancedConversionAnalyticsService;
    }

    // Import Supabase service
    const { SupabaseService: SupabaseServiceImport } = await import('../backend/dist/services/supabase.service.js');
    SupabaseService = SupabaseServiceImport;
    
    const enhancedService = new EnhancedConversionAnalyticsService();
    const supabaseService = new SupabaseService();
    
    console.log('✅ Services initialized successfully');
    console.log('');

    // Check if shop exists
    console.log('🔍 Verifying shop exists...');
    const store = await supabaseService.getStore(shopDomain);
    if (!store) {
      console.error(`❌ Shop not found: ${shopDomain}`);
      console.log('💡 Available shops in database:');
      
      const { data: shops } = await supabaseService.client
        .from('stores')
        .select('shop_domain')
        .limit(10);
      
      if (shops && shops.length > 0) {
        shops.forEach(shop => console.log(`   - ${shop.shop_domain}`));
      } else {
        console.log('   (No shops found in database)');
      }
      
      process.exit(1);
    }
    console.log(`✅ Shop found: ${store.shop_domain}`);
    console.log('');

    // Check current state of data
    console.log('📋 Checking current data state...');
    
    const { data: existingRecs, error: recError } = await supabaseService.client
      .from('simple_recommendations')
      .select('id')
      .eq('shop_domain', shopDomain);
    
    const { data: existingConversions, error: convError } = await supabaseService.client
      .from('simple_conversions')
      .select('id')
      .eq('shop_domain', shopDomain);

    const existingRecommendations = existingRecs?.length || 0;
    const existingConversionsCount = existingConversions?.length || 0;
    
    console.log(`   📊 Current recommendations: ${existingRecommendations}`);
    console.log(`   💰 Current conversions: ${existingConversionsCount}`);
    
    if (existingConversionsCount > 0 && !options.force && !options.dryRun) {
      console.log('⚠️  Warning: Existing conversion data found for this shop');
      console.log('   Use --force to overwrite existing data');
      console.log('   Or use --dry-run to see what would be created');
      if (!options.conversionsOnly) {
        process.exit(1);
      }
    }

    console.log('');
    const startTime = Date.now();

    let backfillResult = null;
    let conversionResult = null;

    // Step 1: Backfill historical recommendations (if not conversions-only)
    if (!options.conversionsOnly) {
      console.log('📝 Step 1: Backfilling historical recommendations from chat messages...');
      
      if (options.dryRun) {
        console.log('🔍 DRY RUN: Would analyze chat messages and extract product recommendations');
        console.log('   This step extracts product mentions from AI agent responses');
        console.log('   and adds them to the simple_recommendations table');
      } else {
        backfillResult = await enhancedService.backfillHistoricalRecommendations(
          shopDomain,
          options.fromDate,
          options.toDate
        );
        
        console.log(`✅ Backfill completed:`);
        console.log(`   📧 Chat messages analyzed: ${backfillResult.chatMessagesAnalyzed}`);
        console.log(`   ➕ New recommendations created: ${backfillResult.newRecommendationsCreated}`);
        console.log(`   📊 Existing recommendations found: ${backfillResult.existingRecommendationsFound}`);
        
        if (options.verbose && backfillResult.productBreakdown.length > 0) {
          console.log('   🏷️  Top products mentioned:');
          backfillResult.productBreakdown.slice(0, 5).forEach((product, i) => {
            console.log(`     ${i + 1}. ${product.productTitle} (${product.occurrences}x, ${product.confidenceAvg}% confidence)`);
          });
        }
      }
      console.log('');
    }

    // Step 2: Process historical conversions (if not backfill-only)
    if (!options.backfillOnly) {
      console.log('🛒 Step 2: Processing historical Shopify orders and matching conversions...');
      
      if (options.dryRun) {
        console.log('🔍 DRY RUN: Would fetch Shopify orders and match with recommendations');
        console.log('   This step processes paid orders from Shopify');
        console.log('   and matches them with recommendations using attribution windows');
        console.log('   Attribution windows: 0-30min (direct), 30min-24h (assisted), 24h-7d (view-through)');
      } else {
        conversionResult = await enhancedService.processHistoricalConversions(shopDomain);
        
        console.log(`✅ Conversion processing completed:`);
        console.log(`   🛍️  Orders processed: ${conversionResult.ordersProcessed}`);
        console.log(`   💰 Conversions created: ${conversionResult.conversionsCreated}`);
        console.log(`   💵 Total attributed revenue: $${conversionResult.totalRevenue}`);
        console.log(`   ⏱️  Average time to conversion: ${conversionResult.averageTimeToConversion} minutes`);
      }
      console.log('');
    }

    // Step 3: Generate analytics summary
    if (!options.dryRun && (!options.backfillOnly || !options.conversionsOnly)) {
      console.log('📈 Step 3: Generating conversion analytics...');
      
      try {
        const dashboard = await enhancedService.generateConversionDashboard(shopDomain, 30);
        
        console.log('✅ Analytics generated successfully:');
        console.log(`   📊 Conversion rate: ${dashboard.overview.conversionRate}%`);
        console.log(`   💰 Total revenue (30 days): $${dashboard.overview.totalRevenue}`);
        console.log(`   🛒 Average order value: $${dashboard.overview.averageOrderValue}`);
        console.log(`   ⏱️  Average time to conversion: ${dashboard.overview.averageTimeToConversion} minutes`);
        
        if (options.verbose && dashboard.topProducts.length > 0) {
          console.log('');
          console.log('🏆 Top converting products (30 days):');
          dashboard.topProducts.slice(0, 5).forEach((product, i) => {
            console.log(`   ${i + 1}. ${product.productTitle}`);
            console.log(`      💰 Revenue: $${product.revenue} (${product.conversions} conversions)`);
            console.log(`      📈 Rate: ${product.conversionRate}% (${product.recommendations} recommendations)`);
          });
        }
        
        console.log('');
        console.log('🎯 Attribution Breakdown:');
        console.log(`   Direct (0-30min): ${dashboard.attributionBreakdown.direct.count} conversions, $${dashboard.attributionBreakdown.direct.revenue}`);
        console.log(`   Assisted (30min-24h): ${dashboard.attributionBreakdown.assisted.count} conversions, $${dashboard.attributionBreakdown.assisted.revenue}`);
        console.log(`   View-through (24h-7d): ${dashboard.attributionBreakdown.viewThrough.count} conversions, $${dashboard.attributionBreakdown.viewThrough.revenue}`);
        
      } catch (analyticsError) {
        console.log('⚠️  Analytics generation failed:', analyticsError.message);
      }
      
      console.log('');
    }

    const totalTime = Date.now() - startTime;
    console.log('🎉 Historical conversion backfill completed successfully!');
    console.log(`⏱️  Total processing time: ${(totalTime / 1000).toFixed(1)} seconds`);
    
    // Final summary
    console.log('');
    console.log('📋 Final Summary:');
    console.log(`   Shop: ${shopDomain}`);
    
    if (backfillResult) {
      console.log(`   New recommendations added: ${backfillResult.newRecommendationsCreated}`);
      console.log(`   Chat messages analyzed: ${backfillResult.chatMessagesAnalyzed}`);
    }
    
    if (conversionResult) {
      console.log(`   Shopify orders processed: ${conversionResult.ordersProcessed}`);
      console.log(`   Conversions created: ${conversionResult.conversionsCreated}`);
      console.log(`   Revenue attributed: $${conversionResult.totalRevenue}`);
    }
    
    console.log(`   Data saved: ${options.dryRun ? 'No (dry run)' : 'Yes'}`);
    
    if (!options.dryRun) {
      console.log('');
      console.log('🎯 Next steps:');
      console.log('   1. Access your admin panel to view the conversion dashboard');
      console.log('   2. Set up ongoing conversion tracking for new recommendations');
      console.log('   3. Monitor conversion rates and optimize product recommendations');
      console.log('');
      console.log('📊 Available endpoints:');
      console.log(`   GET /api/admin-bypass/stats?shop=${shopDomain}`);
      console.log(`   GET /api/simple-conversions/dashboard?shop=${shopDomain}`);
      console.log(`   GET /api/simple-conversions/stats?shop=${shopDomain}`);
    }
    
  } catch (error) {
    console.error('');
    console.error('❌ Migration failed with error:', error.message);
    if (options.verbose) {
      console.error('');
      console.error('📋 Error details:', error);
    }
    
    // Provide helpful error solutions
    console.error('');
    console.error('💡 Possible solutions:');
    if (error.message.includes('Shop not found')) {
      console.error('   - Verify the shop domain is correct');
      console.error('   - Ensure the shop is properly set up in the database');
    } else if (error.message.includes('Failed to fetch')) {
      console.error('   - Check your internet connection');
      console.error('   - Verify Supabase credentials in config/.env');
      console.error('   - Check if the database tables exist');
    } else if (error.message.includes('Shopify')) {
      console.error('   - Verify Shopify API credentials');
      console.error('   - Check if the Shopify store access token is valid');
      console.error('   - Ensure proper Shopify API permissions');
    } else {
      console.error('   - Try running with --dry-run first to identify issues');
      console.error('   - Check the backend build: cd backend && npm run build');
      console.error('   - Verify all environment variables in config/.env');
    }
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('⏹️  Migration interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('');
  console.log('⏹️  Migration terminated');
  process.exit(0);
});

// Run the migration
main().then(() => {
  console.log('');
  console.log('✅ Backfill script completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('');
  console.error('❌ Unexpected error in main process:', error);
  process.exit(1);
});