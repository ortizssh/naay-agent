#!/bin/bash

# Build WordPress Plugin for Distribution
# This script creates a distributable ZIP file of the Kova Agent WordPress plugin

set -e

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PLUGIN_DIR="$PROJECT_ROOT/wordpress-plugin/kova-agent"
OUTPUT_DIR="$PROJECT_ROOT/backend/public/downloads"
PLUGIN_SLUG="kova-agent"

# Get version from plugin file
VERSION=$(grep -m1 "Version:" "$PLUGIN_DIR/kova-agent.php" | sed 's/.*Version: *//' | tr -d '[:space:]')

if [ -z "$VERSION" ]; then
    echo "Error: Could not extract version from kova-agent.php"
    exit 1
fi

echo "Building Kova Agent WordPress Plugin v$VERSION"
echo "=============================================="

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Create a temporary directory for the build
BUILD_DIR=$(mktemp -d)
PLUGIN_BUILD_DIR="$BUILD_DIR/$PLUGIN_SLUG"

echo "📦 Copying plugin files..."
mkdir -p "$PLUGIN_BUILD_DIR"

# Copy all plugin files
cp -R "$PLUGIN_DIR"/* "$PLUGIN_BUILD_DIR/"

# Remove development files that shouldn't be in the distribution
echo "🧹 Cleaning development files..."
cd "$PLUGIN_BUILD_DIR"

# Remove any git files
rm -rf .git .gitignore .gitattributes 2>/dev/null || true

# Remove any node_modules or package files
rm -rf node_modules package.json package-lock.json 2>/dev/null || true

# Remove any editor config files
rm -rf .editorconfig .prettierrc .eslintrc* 2>/dev/null || true

# Remove any IDE folders
rm -rf .idea .vscode 2>/dev/null || true

# Remove any test files
rm -rf tests test *.test.* 2>/dev/null || true

# Remove any build/cache files
rm -rf .cache .tmp 2>/dev/null || true

# Go back to build directory
cd "$BUILD_DIR"

# Create the ZIP file
OUTPUT_FILE="$OUTPUT_DIR/$PLUGIN_SLUG.zip"
OUTPUT_FILE_VERSIONED="$OUTPUT_DIR/$PLUGIN_SLUG-$VERSION.zip"

echo "📦 Creating ZIP archive..."
zip -r "$OUTPUT_FILE" "$PLUGIN_SLUG" -x "*.DS_Store" "*.gitkeep"

# Also create a versioned copy
cp "$OUTPUT_FILE" "$OUTPUT_FILE_VERSIONED"

# Clean up
rm -rf "$BUILD_DIR"

# Get file size
FILE_SIZE=$(ls -lh "$OUTPUT_FILE" | awk '{print $5}')

echo ""
echo "✅ Build complete!"
echo ""
echo "Output files:"
echo "  📄 $OUTPUT_FILE ($FILE_SIZE)"
echo "  📄 $OUTPUT_FILE_VERSIONED ($FILE_SIZE)"
echo ""
echo "Version: $VERSION"
echo ""
echo "To update the version, edit these files:"
echo "  1. wordpress-plugin/kova-agent/kova-agent.php (Version header)"
echo "  2. wordpress-plugin/kova-agent/kova-agent.php (KOVA_AGENT_VERSION constant)"
echo "  3. backend/src/platforms/woocommerce/controllers/woo-plugin-update.controller.ts (version field)"
