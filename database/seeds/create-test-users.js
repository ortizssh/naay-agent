/**
 * Script to create test users for development
 * Run with: node database/seeds/create-test-users.js
 */

const crypto = require('crypto');

// Load environment variables
require('dotenv').config({ path: './config/.env' });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'kova-admin-secret-key-change-in-production';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Hash password function (same as in admin-auth.controller.ts)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

const TEST_PASSWORD = 'Test1234!';
const passwordHash = hashPassword(TEST_PASSWORD);

async function createTestUsers() {
  console.log('Creating test users...');
  console.log('Password hash:', passwordHash);

  // Create Admin user
  const adminUser = {
    email: 'admin@test.com',
    password_hash: passwordHash,
    first_name: 'Admin',
    last_name: 'Test',
    company: 'Kova',
    role: 'admin',
    plan: 'enterprise',
    status: 'active',
    user_type: 'admin',
    onboarding_completed: true,
    onboarding_step: 4,
  };

  // Create Client user
  const clientUser = {
    email: 'cliente@test.com',
    password_hash: passwordHash,
    first_name: 'Cliente',
    last_name: 'Test',
    company: 'Mi Tienda',
    role: 'viewer',
    plan: 'starter',
    status: 'active',
    user_type: 'client',
    onboarding_completed: false,
    onboarding_step: 0,
  };

  // Insert Admin
  const { data: admin, error: adminError } = await supabase
    .from('admin_users')
    .upsert(adminUser, { onConflict: 'email' })
    .select()
    .single();

  if (adminError) {
    console.error('Error creating admin user:', adminError);
  } else {
    console.log('Admin user created/updated:', admin.email);
  }

  // Insert Client
  const { data: client, error: clientError } = await supabase
    .from('admin_users')
    .upsert(clientUser, { onConflict: 'email' })
    .select()
    .single();

  if (clientError) {
    console.error('Error creating client user:', clientError);
  } else {
    console.log('Client user created/updated:', client.email);
  }

  // Show summary
  console.log('\n========================================');
  console.log('Test Users Created Successfully!');
  console.log('========================================');
  console.log('\nAdmin User:');
  console.log('  Email: admin@test.com');
  console.log('  Password: Test1234!');
  console.log('  Type: admin');
  console.log('\nClient User:');
  console.log('  Email: cliente@test.com');
  console.log('  Password: Test1234!');
  console.log('  Type: client (needs onboarding)');
  console.log('========================================\n');
}

createTestUsers()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
