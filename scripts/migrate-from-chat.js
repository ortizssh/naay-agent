#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', 'config', '.env') });

const { createClient } = require('@supabase/supabase-js');

async function migrateFromChatMessages() {
  console.log('🔄 Chat Messages to Simple Conversions Migration');
  console.log('===============================================');
  
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  
  try {
    // Step 1: Get agent messages with product recommendations
    console.log('1️⃣  Extracting product recommendations from chat...');
    const { data: agentMessages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('role', 'agent')
      .order('timestamp', { ascending: false })
      .limit(200); // Get recent messages
    
    if (error) {
      console.error('❌ Error fetching agent messages:', error.message);
      return;
    }
    
    console.log(`📊 Found ${agentMessages.length} agent messages`);
    
    // Step 2: Extract product recommendations using patterns
    console.log('\n2️⃣  Analyzing messages for product patterns...');
    const recommendations = [];
    
    agentMessages.forEach(msg => {
      if (!msg.content || !msg.session_id || !msg.timestamp) return;
      
      const content = msg.content;
      const sessionId = msg.session_id;
      const timestamp = new Date(msg.timestamp);
      
      // Product patterns to extract
      const productPatterns = [
        // Spanish product names
        /(?:crema|gel|elixir|emulsión|bálsamo|aceite)\\s+[^\\n\\.]{5,50}/gi,
        // Products with specific names
        /(Delicate Touch|Delicate Splendor|Fresh Purity|Hydra Wonder|Rich Splendor|Super Hero)/gi,
        // Products with "Ácido Hialurónico"
        /(Ácido Hialurónico[^\\n\\.]{0,30})/gi,
        // Bold text that might be products
        /\\*\\*([^*]{5,50})\\*\\*/g
      ];
      
      productPatterns.forEach((pattern, patternIndex) => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const productTitle = (match[1] || match[0]).trim();
          
          // Skip if too generic
          if (productTitle.length < 5 || 
              /^(para|con|que|como|una|esta|eso)$/i.test(productTitle)) {
            continue;
          }
          
          // Create a synthetic product ID
          const productId = `product_${Buffer.from(productTitle).toString('base64').substring(0, 10)}`;
          
          recommendations.push({
            session_id: sessionId,
            shop_domain: 'naay-cosmetics.myshopify.com', // Default shop
            product_id: productId,
            product_title: productTitle,
            recommended_at: timestamp.toISOString(),
            expires_at: new Date(timestamp.getTime() + 10 * 60 * 1000).toISOString(),
            message_id: msg.id
          });
        }
      });
    });
    
    // Remove duplicates based on session + product
    const uniqueRecommendations = recommendations.filter((rec, index, arr) => {
      return arr.findIndex(r => r.session_id === rec.session_id && r.product_id === rec.product_id) === index;
    });
    
    console.log(`🎯 Extracted ${uniqueRecommendations.length} unique product recommendations`);
    
    if (uniqueRecommendations.length === 0) {
      console.log('ℹ️  No product recommendations found');
      return;
    }
    
    // Step 3: Save recommendations to simple_recommendations
    console.log('\n3️⃣  Saving recommendations to database...');
    
    const batchSize = 50;
    let saved = 0;
    
    for (let i = 0; i < uniqueRecommendations.length; i += batchSize) {
      const batch = uniqueRecommendations.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('simple_recommendations')
        .upsert(batch, {
          onConflict: 'session_id,product_id',
          ignoreDuplicates: true
        });
      
      if (insertError) {
        console.log(`⚠️  Error saving batch ${Math.floor(i/batchSize) + 1}:`, insertError.message);
      } else {
        saved += batch.length;
        console.log(`   ✅ Saved batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(uniqueRecommendations.length/batchSize)} (${batch.length} recommendations)`);
      }
    }
    
    console.log(`✅ Saved ${saved} recommendations`);
    
    // Step 4: Simulate some conversions (10% conversion rate)
    console.log('\n4️⃣  Simulating historical conversions...');
    
    const simulateConversions = uniqueRecommendations
      .filter(() => Math.random() < 0.1) // 10% conversion rate
      .map(rec => {
        const purchaseDelay = Math.floor(Math.random() * 8) + 2; // 2-9 minutes
        const purchaseTime = new Date(new Date(rec.recommended_at).getTime() + purchaseDelay * 60 * 1000);
        const confidence = Math.max(0.1, 1 - (purchaseDelay / 10));
        const orderAmount = 15 + Math.random() * 85; // €15-100
        
        return {
          session_id: rec.session_id,
          order_id: `simulated_order_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          product_id: rec.product_id,
          shop_domain: rec.shop_domain,
          recommended_at: rec.recommended_at,
          purchased_at: purchaseTime.toISOString(),
          minutes_to_conversion: purchaseDelay,
          confidence: Math.round(confidence * 100) / 100,
          order_quantity: Math.floor(Math.random() * 3) + 1,
          order_amount: Math.round(orderAmount * 100) / 100,
          total_order_amount: Math.round(orderAmount * 100) / 100
        };
      });
    
    if (simulateConversions.length > 0) {
      const { error: conversionError } = await supabase
        .from('simple_conversions')
        .upsert(simulateConversions, {
          onConflict: 'session_id,order_id,product_id',
          ignoreDuplicates: true
        });
      
      if (conversionError) {
        console.log('⚠️  Error saving conversions:', conversionError.message);
      } else {
        console.log(`✅ Simulated ${simulateConversions.length} conversions`);
      }
    }
    
    // Step 5: Get stats
    console.log('\n5️⃣  Getting conversion statistics...');
    
    const { data: stats, error: statsError } = await supabase
      .rpc('get_simple_conversion_stats', {
        p_shop_domain: 'naay-cosmetics.myshopify.com',
        p_days_back: 30
      });
    
    if (!statsError && stats && stats.length > 0) {
      const stat = stats[0];
      console.log('📊 Conversion Statistics:');
      console.log(`   Total Recommendations: ${stat.total_recommendations}`);
      console.log(`   Total Conversions: ${stat.total_conversions}`);
      console.log(`   Conversion Rate: ${stat.conversion_rate}%`);
      console.log(`   Avg Time to Convert: ${stat.avg_minutes_to_conversion} minutes`);
      console.log(`   Total Revenue: €${stat.total_revenue}`);
    }
    
    // Step 6: Show sample products
    console.log('\n6️⃣  Sample extracted products:');
    const sampleProducts = [...new Set(uniqueRecommendations.map(r => r.product_title))]
      .slice(0, 10);
    
    sampleProducts.forEach((product, i) => {
      console.log(`   ${i + 1}. ${product}`);
    });
    
    if (sampleProducts.length > 10) {
      console.log(`   ... and ${sampleProducts.length - 10} more`);
    }
    
    console.log('\n✅ Migration from chat messages completed!');
    console.log('==========================================');
    console.log(`📦 Extracted products: ${[...new Set(uniqueRecommendations.map(r => r.product_title))].length}`);
    console.log(`🎯 Total recommendations: ${saved}`);
    console.log(`💰 Simulated conversions: ${simulateConversions.length}`);
    console.log('');
    console.log('🔍 Monitor with:');
    console.log('   GET /api/simple-conversions/dashboard?shop=naay-cosmetics.myshopify.com');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Handle direct execution
if (require.main === module) {
  migrateFromChatMessages().catch(console.error);
}

module.exports = migrateFromChatMessages;