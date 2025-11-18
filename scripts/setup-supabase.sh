#!/bin/bash

# Setup script for Supabase configuration
echo "🚀 Setting up Supabase for Naay Agent..."

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Initialize Supabase project (if not already initialized)
if [ ! -f "supabase/config.toml" ]; then
    echo "📁 Initializing Supabase project..."
    supabase init
fi

# Start Supabase local development
echo "🔧 Starting Supabase local development..."
supabase start

# Run migrations
echo "📊 Running database migrations..."
supabase db reset --local

# Apply initial schema
echo "🏗️ Applying initial schema..."
supabase db push --local --include-all

# Generate types
echo "📝 Generating TypeScript types..."
supabase gen types typescript --local > backend/src/types/supabase.ts

# Apply functions
echo "🔧 Creating database functions..."
supabase db push --local --include-functions

echo "✅ Supabase setup completed!"
echo ""
echo "Next steps:"
echo "1. Copy your Supabase URL and keys to .env file"
echo "2. Update config/.env with your Supabase credentials"
echo "3. Run 'npm run dev:backend' to start the backend server"
echo ""
echo "Local Supabase URLs:"
echo "Dashboard: http://localhost:54323"
echo "API URL: http://localhost:54321"
echo "DB URL: postgresql://postgres:postgres@localhost:54322/postgres"