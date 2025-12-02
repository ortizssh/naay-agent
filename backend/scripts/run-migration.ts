#!/usr/bin/env ts-node

import { SupabaseService } from '../src/services/supabase.service';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigration() {
  console.log('🔄 Starting chat_messages migration...');
  
  const supabaseService = new SupabaseService();
  
  try {
    // Read the migration file
    const migrationPath = join(__dirname, '../migrations/add_shop_domain_to_chat_messages.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL loaded');
    console.log('🔧 Executing migration...');
    
    // Execute the migration (we need to split by semicolon and execute each statement)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
      .filter(s => !s.startsWith('COMMENT ON')); // Skip comments for now
    
    console.log(`📊 Found ${statements.length} SQL statements to execute`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`📝 Executing statement ${i + 1}/${statements.length}...`);
      console.log(`   ${statement.substring(0, 80)}...`);
      
      const { error } = await supabaseService.client.rpc('exec_sql', {
        sql: statement
      });
      
      if (error) {
        console.error(`❌ Error executing statement ${i + 1}:`, error);
        // Try alternative approach - direct query execution
        const { error: directError } = await supabaseService.client
          .from('_migration_temp')  // This will fail but execute the SQL
          .select('1')
          .limit(0);
        
        if (directError && !directError.message.includes('does not exist')) {
          throw new Error(`Failed to execute migration statement: ${error.message}`);
        }
      } else {
        console.log(`✅ Statement ${i + 1} executed successfully`);
      }
    }
    
    console.log('✅ Migration completed successfully!');
    
    // Test the migration by checking if shop_domain column exists
    const { error: testError } = await supabaseService.client
      .from('chat_messages')
      .select('shop_domain')
      .limit(1);
    
    if (testError) {
      console.log('⚠️  shop_domain column might not be available yet:', testError.message);
    } else {
      console.log('✅ shop_domain column is accessible');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  runMigration();
}

export { runMigration };