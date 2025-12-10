#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', 'config', '.env') });

// Import the service (we'll need to compile TypeScript first or use ts-node)
const { HistoricalConversionMigrator } = require('../backend/dist/services/historical-conversion-migrator.service.js');

async function runMigration() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const options = {
    shop: null,
    daysBack: 30,
    dryRun: true,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--shop':
        options.shop = args[++i];
        break;
      case '--days':
        options.daysBack = parseInt(args[++i]) || 30;
        break;
      case '--execute':
        options.dryRun = false;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        console.log(`Unknown argument: ${arg}`);
        options.help = true;
    }
  }

  if (options.help) {
    printHelp();
    return;
  }

  console.log('🔄 Historical Conversion Migration');
  console.log('==================================');
  console.log(`Shop: ${options.shop || 'ALL SHOPS'}`);
  console.log(`Days Back: ${options.daysBack}`);
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'EXECUTE'}`);
  console.log(`Attribution Window: 10 minutes`);
  console.log('');

  if (options.dryRun) {
    console.log('⚠️  DRY RUN MODE - No data will be written');
    console.log('   Use --execute to actually save conversions');
    console.log('');
  }

  try {
    const migrator = new HistoricalConversionMigrator();
    
    // Show status first
    if (options.shop) {
      console.log('📊 Checking migration status...');
      const status = await migrator.getMigrationStatus(options.shop);
      
      console.log('Current Status:');
      console.log(`  Historical Recommendations: ${status.counts.recommendations}`);
      console.log(`  Historical Orders: ${status.counts.orders}`);
      console.log(`  Simple Conversions: ${status.counts.simpleConversions}`);
      console.log(`  Last Recommendation: ${status.lastRecommendation || 'None'}`);
      console.log(`  Last Order: ${status.lastOrder || 'None'}`);
      console.log(`  Last Conversion: ${status.lastConversion || 'None'}`);
      console.log('');

      if (!status.hasHistoricalRecommendations && !status.hasHistoricalOrders) {
        console.log('❌ No historical data found for this shop');
        return;
      }
    }

    // Run migration
    console.log('🚀 Starting migration process...');
    const startTime = Date.now();
    
    const result = await migrator.migrateHistoricalConversions(
      options.shop,
      options.daysBack,
      options.dryRun
    );

    const duration = Date.now() - startTime;

    // Display results
    console.log('');
    console.log('✅ Migration completed!');
    console.log('=====================');
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log('');
    console.log('Data Processed:');
    console.log(`  Recommendations: ${result.processed.recommendations.toLocaleString()}`);
    console.log(`  Orders: ${result.processed.orders.toLocaleString()}`);
    console.log(`  Conversions Found: ${result.processed.conversions.toLocaleString()}`);
    console.log('');
    console.log('Conversion Summary:');
    console.log(`  Total Revenue: $${result.summary.totalRevenue.toLocaleString()}`);
    console.log(`  Conversion Rate: ${result.summary.conversionRate.toFixed(2)}%`);
    console.log(`  Avg Time to Convert: ${result.summary.averageMinutesToConversion.toFixed(1)} minutes`);
    console.log('');

    if (result.conversions.length > 0) {
      console.log('📈 Sample Conversions (first 5):');
      const sample = result.conversions.slice(0, 5);
      sample.forEach((conv, index) => {
        console.log(`  ${index + 1}. Session: ${conv.sessionId.substring(0, 8)}...`);
        console.log(`     Product: ${conv.productId}`);
        console.log(`     Time: ${conv.minutesToConversion} min, Confidence: ${(conv.confidence * 100).toFixed(0)}%`);
        console.log(`     Revenue: $${conv.orderAmount.toFixed(2)}`);
        console.log('');
      });

      if (!options.dryRun) {
        console.log('💾 Conversions have been saved to simple_conversions table');
      } else {
        console.log('💡 Run with --execute to save these conversions to the database');
      }
    } else {
      console.log('ℹ️  No conversions found within the 10-minute attribution window');
    }

    // Save results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `migration-results-${timestamp}.json`;
    const resultFile = path.join(__dirname, '..', 'logs', filename);
    
    // Ensure logs directory exists
    const logsDir = path.dirname(resultFile);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    fs.writeFileSync(resultFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      options,
      result,
      duration
    }, null, 2));

    console.log(`📄 Full results saved to: ${filename}`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('Full error:', error);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
Historical Conversion Migration Tool

USAGE:
  node scripts/migrate-historical-conversions.js [OPTIONS]

OPTIONS:
  --shop DOMAIN      Process only this shop (e.g., mystore.myshopify.com)
  --days NUMBER      Number of days back to process (default: 30)
  --execute          Actually save conversions (default is dry run)
  --help, -h         Show this help message

EXAMPLES:
  # Preview conversions for all shops (last 7 days)
  node scripts/migrate-historical-conversions.js --days 7

  # Preview conversions for specific shop
  node scripts/migrate-historical-conversions.js --shop mystore.myshopify.com

  # Execute migration for specific shop (last 30 days)
  node scripts/migrate-historical-conversions.js --shop mystore.myshopify.com --execute

  # Execute migration for all shops (last 60 days)
  node scripts/migrate-historical-conversions.js --days 60 --execute

NOTES:
  - Default mode is DRY RUN - use --execute to actually save data
  - Attribution window is fixed at 10 minutes
  - Results are saved to logs/migration-results-TIMESTAMP.json
  - Existing conversions with same session+order+product are skipped

REQUIREMENTS:
  - Ensure backend is compiled: npm run build
  - Database tables created: simple_recommendations, simple_conversions
  - Environment variables configured in config/.env
`);
}

// Handle direct execution
if (require.main === module) {
  runMigration().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = runMigration;