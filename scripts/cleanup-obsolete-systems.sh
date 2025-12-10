#!/bin/bash

echo "🧹 Cleaning up obsolete conversion systems..."
echo "============================================="

# Backup directory
BACKUP_DIR="./backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📁 Creating backup in: $BACKUP_DIR"

# Files to remove (backup first, then delete)
OBSOLETE_FILES=(
    "backend/src/controllers/conversion-analytics.controller.ts"
    "backend/src/controllers/admin-conversion-analytics.controller.ts"
    "backend/src/controllers/admin-bypass-refactored.controller.ts"
    "backend/src/services/conversion-tracking.service.ts"
)

echo ""
echo "📋 Files to be removed:"
for file in "${OBSOLETE_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ❌ $file"
    else
        echo "  ⚠️  $file (not found)"
    fi
done

echo ""
read -p "⚠️  Do you want to proceed with cleanup? [y/N]: " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled"
    exit 1
fi

echo ""
echo "🔄 Starting cleanup process..."

# Backup and remove files
for file in "${OBSOLETE_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  📦 Backing up: $file"
        cp "$file" "$BACKUP_DIR/$(basename "$file")"
        
        echo "  ❌ Removing: $file"
        rm "$file"
    fi
done

echo ""
echo "🔧 Updating index.ts to remove obsolete imports..."

# Remove obsolete imports from index.ts
INDEX_FILE="backend/src/index.ts"
if [ -f "$INDEX_FILE" ]; then
    # Backup index.ts
    cp "$INDEX_FILE" "$BACKUP_DIR/index.ts.backup"
    
    # Remove obsolete import lines
    sed -i.bak '/conversionAnalyticsRoutes.*conversion-analytics.controller/d' "$INDEX_FILE"
    sed -i.bak '/adminConversionAnalyticsRoutes.*admin-conversion-analytics.controller/d' "$INDEX_FILE"
    
    # Remove obsolete route registrations  
    sed -i.bak '/api\/analytics\/conversion.*conversionAnalyticsRoutes/d' "$INDEX_FILE"
    sed -i.bak '/api\/admin\/analytics\/conversion.*adminConversionAnalyticsRoutes/d' "$INDEX_FILE"
    
    # Clean up backup file
    rm "${INDEX_FILE}.bak" 2>/dev/null || true
    
    echo "  ✅ Updated index.ts"
else
    echo "  ⚠️  index.ts not found"
fi

echo ""
echo "🔍 Checking for remaining references..."

# Search for references to removed files
SEARCH_PATTERNS=(
    "conversion-analytics.controller"
    "admin-conversion-analytics.controller"  
    "admin-bypass-refactored.controller"
    "conversion-tracking.service"
    "ConversionTrackingService"
)

found_references=false
for pattern in "${SEARCH_PATTERNS[@]}"; do
    echo "  🔍 Searching for: $pattern"
    if grep -r "$pattern" backend/src/ --include="*.ts" 2>/dev/null; then
        found_references=true
        echo "    ⚠️  References found above"
    else
        echo "    ✅ No references found"
    fi
done

echo ""
if [ "$found_references" = true ]; then
    echo "⚠️  Manual cleanup required for remaining references"
    echo "   Please review and remove the references shown above"
else
    echo "✅ No remaining references found"
fi

echo ""
echo "📊 Cleanup Summary:"
echo "  📦 Backup created: $BACKUP_DIR"
echo "  ❌ Files removed: ${#OBSOLETE_FILES[@]}"
echo "  🔧 index.ts updated"
echo ""
echo "🎯 Next steps:"
echo "  1. Run: npm run build (to check for compilation errors)"
echo "  2. Test that existing functionality still works"
echo "  3. Remove backup directory if everything works: rm -rf $BACKUP_DIR"
echo ""
echo "✅ Cleanup completed!"