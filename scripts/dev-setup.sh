#!/bin/bash

# Development setup script for Naay Agent
echo "🚀 Setting up Naay Agent for development..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if required tools are installed
check_requirements() {
    print_info "Checking requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node -v)"
        exit 1
    fi
    print_status "Node.js $(node -v) ✓"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed."
        exit 1
    fi
    print_status "npm $(npm -v) ✓"
    
    # Check Shopify CLI
    if ! command -v shopify &> /dev/null; then
        print_warning "Shopify CLI not found. Installing..."
        npm install -g @shopify/cli @shopify/theme
        
        if ! command -v shopify &> /dev/null; then
            print_error "Failed to install Shopify CLI"
            exit 1
        fi
    fi
    print_status "Shopify CLI $(shopify version) ✓"
    
    # Check git
    if ! command -v git &> /dev/null; then
        print_warning "Git is not installed. Some features may not work."
    else
        print_status "Git $(git --version | cut -d' ' -f3) ✓"
    fi
}

# Install dependencies
install_dependencies() {
    print_info "Installing dependencies..."
    
    # Install root dependencies
    if npm install; then
        print_status "Root dependencies installed"
    else
        print_error "Failed to install root dependencies"
        exit 1
    fi
    
    # Install backend dependencies
    if cd backend && npm install && cd ..; then
        print_status "Backend dependencies installed"
    else
        print_error "Failed to install backend dependencies"
        exit 1
    fi
    
    # Install widget dependencies
    if cd frontend-widget && npm install && cd ..; then
        print_status "Widget dependencies installed"
    else
        print_error "Failed to install widget dependencies"
        exit 1
    fi
}

# Setup environment
setup_environment() {
    print_info "Setting up environment..."
    
    if [ ! -f "config/.env" ]; then
        if [ -f "config/.env.example" ]; then
            cp config/.env.example config/.env
            print_status "Created .env file from template"
        else
            print_error ".env.example not found"
            exit 1
        fi
    else
        print_warning ".env file already exists, skipping..."
    fi
}

# Build projects
build_projects() {
    print_info "Building projects..."
    
    # Build widget
    if cd frontend-widget && npm run build && cd ..; then
        print_status "Widget built successfully"
    else
        print_error "Failed to build widget"
        exit 1
    fi
    
    # Build backend
    if cd backend && npm run build && cd ..; then
        print_status "Backend built successfully"
    else
        print_error "Failed to build backend"
        exit 1
    fi
}

# Setup development certificates (for HTTPS)
setup_certificates() {
    print_info "Setting up development certificates..."
    
    if command -v mkcert &> /dev/null; then
        if [ ! -f "localhost.pem" ]; then
            mkcert localhost 127.0.0.1 ::1
            print_status "Development certificates created"
        else
            print_warning "Certificates already exist"
        fi
    else
        print_warning "mkcert not found. You may need HTTPS certificates for Shopify development."
        print_info "Install mkcert: https://github.com/FiloSottile/mkcert"
    fi
}

# Print setup completion and next steps
print_completion() {
    echo ""
    print_status "🎉 Development setup completed!"
    echo ""
    print_info "Next steps:"
    echo "1. Update config/.env with your credentials:"
    echo "   - Shopify API keys"
    echo "   - Supabase URL and keys" 
    echo "   - OpenAI API key"
    echo ""
    echo "2. Set up Supabase:"
    echo "   ./scripts/setup-supabase.sh"
    echo ""
    echo "3. Start development servers:"
    echo "   npm run dev              # All services"
    echo "   npm run dev:backend      # Backend only"
    echo "   npm run dev:widget       # Widget only"
    echo "   npm run dev:shopify      # Shopify app dev server"
    echo ""
    echo "4. For Shopify development:"
    echo "   - Create a new app in Partners Dashboard"
    echo "   - Update shopify.app.toml with your app details"
    echo "   - Run: shopify app dev"
    echo ""
    print_info "📚 Documentation: docs/ folder"
    print_info "🐛 Issues: Create issues in your repository"
    echo ""
}

# Main execution
main() {
    echo ""
    echo "🤖 Naay Agent - Shopify AI Assistant"
    echo "=================================="
    echo ""
    
    check_requirements
    install_dependencies
    setup_environment
    build_projects
    setup_certificates
    print_completion
}

# Run if executed directly
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi