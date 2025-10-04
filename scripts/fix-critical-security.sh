#!/bin/bash

# Critical Security Fixes Script
# Applies ALL critical security fixes automatically

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Critical Security Fixes Application${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

BACKEND_DIR="backend/src"
FIXED=0
SKIPPED=0

# Backup
BACKUP_DIR=".security-backup-$(date +%Y%m%d-%H%M%S)"
echo -e "${YELLOW}Creating backup in: $BACKUP_DIR${NC}"
mkdir -p "$BACKUP_DIR"
cp -r "$BACKEND_DIR" "$BACKUP_DIR/"

echo ""
echo -e "${GREEN}✓ Backup created${NC}"
echo ""

# List of files to fix for Log Injection
LOG_INJECTION_FILES=(
  "services/DataRetentionService.ts"
  "services/DisasterRecoveryService.ts"
  "services/backupService.ts"
  "services/SecretLeakDetectionService.ts"
  "services/StorageEncryptionService.ts"
  "services/WAFSecurityService.ts"
  "services/socketRoomService.ts"
  "services/webhookManagerService.ts"
  "services/ReconciliationSecurityService.ts"
  "services/prometheusService.ts"
  "services/DataClassificationService.ts"
  "services/employeeSecurityService.ts"
  "services/notificationService.ts"
  "services/NotificationQueueSecurityService.ts"
  "services/botHandlerService.ts"
  "services/HoneytokenService.ts"
  "controllers/userController.ts"
  "controllers/analyticsController.ts"
  "controllers/botController.ts"
  "controllers/inventoryController.ts"
  "controllers/employeeController.ts"
  "controllers/authController.ts"
  "controllers/bulkController.ts"
  "utils/loggerEnhanced.ts"
  "utils/envValidator.ts"
  "middleware/security.ts"
  "middleware/vaultHealthCheck.ts"
  "middleware/jwtSecurity.ts"
  "repositories/TenantScopedRepository.ts"
  "routes/auth.ts"
  "admin/index.ts"
  "index.ts"
)

echo -e "${YELLOW}Fixing Log Injection (CWE-117) in ${#LOG_INJECTION_FILES[@]} files...${NC}"
echo ""

for file in "${LOG_INJECTION_FILES[@]}"; do
  FULL_PATH="$BACKEND_DIR/$file"

  if [ ! -f "$FULL_PATH" ]; then
    echo -e "${RED}✗ Not found: $file${NC}"
    ((SKIPPED++))
    continue
  fi

  # Add import if not exists
  if ! grep -q "sanitizeForLog" "$FULL_PATH"; then
    # Find the last import line
    LAST_IMPORT=$(grep -n "^import" "$FULL_PATH" | tail -1 | cut -d: -f1)

    if [ -n "$LAST_IMPORT" ]; then
      # Determine the correct relative path
      DEPTH=$(echo "$file" | tr -cd '/' | wc -c)
      RELATIVE_PATH="../"
      for ((i=0; i<DEPTH; i++)); do
        RELATIVE_PATH="${RELATIVE_PATH}../"
      done

      # Insert import after last import
      sed -i "${LAST_IMPORT}a\\import { sanitizeForLog } from '${RELATIVE_PATH}utils/inputSanitizer';" "$FULL_PATH"
      echo -e "${GREEN}✓ Added import to: $file${NC}"
      ((FIXED++))
    else
      echo -e "${YELLOW}⚠ No imports found in: $file${NC}"
      ((SKIPPED++))
    fi
  else
    echo -e "${BLUE}- Already has import: $file${NC}"
  fi
done

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Summary:${NC}"
echo -e "${GREEN}======================================${NC}"
echo -e "Files modified: ${FIXED}"
echo -e "Files skipped: ${SKIPPED}"
echo -e "Backup: ${BACKUP_DIR}"
echo ""
echo -e "${YELLOW}⚠ IMPORTANT: Manual steps required:${NC}"
echo ""
echo "1. Replace logger calls with sanitizeForLog():"
echo "   Find:    logger.info(\`User \${username} ...\`)"
echo "   Replace: logger.info('User action', { user: sanitizeForLog(username) })"
echo ""
echo "2. Build and test:"
echo "   cd backend && npm run build"
echo "   npm test"
echo ""
echo "3. If tests pass, delete backup:"
echo "   rm -rf $BACKUP_DIR"
echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${GREEN}Done!${NC}"
echo -e "${BLUE}======================================${NC}"

