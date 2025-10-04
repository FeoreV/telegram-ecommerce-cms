#!/bin/bash

# Security Fixes Mass Application Script
# Applies security sanitization to multiple files automatically

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}Security Fixes Mass Application${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

BACKEND_DIR="backend/src"
FIXED_COUNT=0
ERROR_COUNT=0

# Check if we're in the right directory
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}Error: backend/src directory not found${NC}"
    echo "Please run this script from project root"
    exit 1
fi

echo -e "${YELLOW}This script will:${NC}"
echo "1. Add sanitizeForLog import to files with logger usage"
echo "2. Add sanitizeHtml import to controllers"
echo "3. Add sanitizeFilePath import to file operation services"
echo ""
echo -e "${YELLOW}Backing up files before modification...${NC}"

# Create backup directory
BACKUP_DIR=".security-fixes-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Function to backup file
backup_file() {
    local file=$1
    local backup_path="$BACKUP_DIR/$file"
    mkdir -p "$(dirname "$backup_path")"
    cp "$file" "$backup_path"
    echo -e "${GREEN}✓${NC} Backed up: $file"
}

# Function to add import if not exists
add_import_if_needed() {
    local file=$1
    local import_line=$2

    if ! grep -q "$import_line" "$file"; then
        # Find the last import line
        local last_import_line=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)

        if [ -n "$last_import_line" ]; then
            # Insert after last import
            sed -i "${last_import_line}a\\$import_line" "$file"
            echo -e "${GREEN}✓${NC} Added import to: $file"
            ((FIXED_COUNT++))
        else
            echo -e "${YELLOW}⚠${NC} No import section found in: $file"
        fi
    fi
}

echo ""
echo -e "${YELLOW}Phase 1: Adding sanitizeForLog to logger files...${NC}"
echo ""

# Find all files with logger usage
while IFS= read -r file; do
    if grep -q "logger\.(info|warn|error|debug)" "$file"; then
        echo "Processing: $file"
        backup_file "$file"
        add_import_if_needed "$file" "import { sanitizeForLog } from '../utils/inputSanitizer';"
    fi
done < <(find "$BACKEND_DIR" -name "*.ts" -type f)

echo ""
echo -e "${YELLOW}Phase 2: Adding sanitizeHtml to controllers...${NC}"
echo ""

# Find all controller files
while IFS= read -r file; do
    echo "Processing: $file"
    backup_file "$file"
    add_import_if_needed "$file" "import { sanitizeHtml, sanitizeText } from '../utils/inputSanitizer';"
done < <(find "$BACKEND_DIR/controllers" -name "*.ts" -type f 2>/dev/null || true)

echo ""
echo -e "${YELLOW}Phase 3: Adding sanitizeFilePath to file services...${NC}"
echo ""

# Find service files with file operations
while IFS= read -r file; do
    if grep -q "fs\.|path\.|readFile\|writeFile\|mkdir\|rmdir" "$file"; then
        echo "Processing: $file"
        backup_file "$file"
        add_import_if_needed "$file" "import { sanitizeFilePath, sanitizeFilename } from '../utils/inputSanitizer';"
    fi
done < <(find "$BACKEND_DIR/services" -name "*.ts" -type f 2>/dev/null || true)

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Summary:${NC}"
echo -e "${GREEN}=========================================${NC}"
echo -e "Files modified: ${FIXED_COUNT}"
echo -e "Errors: ${ERROR_COUNT}"
echo -e "Backup location: ${BACKUP_DIR}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review changes in modified files"
echo "2. Apply sanitization functions manually where needed"
echo "3. Run: npm run build"
echo "4. Run tests: npm test"
echo "5. If everything works, delete backup: rm -rf $BACKUP_DIR"
echo ""
echo -e "${BLUE}=========================================${NC}"
echo -e "${GREEN}Done!${NC}"
echo -e "${BLUE}=========================================${NC}"

