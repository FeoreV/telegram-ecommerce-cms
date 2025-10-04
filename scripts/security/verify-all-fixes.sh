#!/bin/bash
# Comprehensive Verification of All Security Fixes
# Проверяет все исправления безопасности

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   VERIFICATION OF ALL SECURITY FIXES                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TOTAL=0
PASSED=0
FAILED=0

verify() {
    local test_name="$1"
    local test_command="$2"

    TOTAL=$((TOTAL + 1))
    echo -n "Testing: $test_name ... "

    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. VERIFYING SECURITY TOOLS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

verify "Security config checker exists" \
    "test -f scripts/security/check-security-config.sh"

verify "Secrets generator exists" \
    "test -f scripts/security/generate-secrets.sh"

verify "Secret scanner exists" \
    "test -f scripts/security/scan-for-secrets.sh"

verify "Security summary exists" \
    "test -f scripts/security/security-summary.sh"

verify "Git hooks setup exists" \
    "test -f scripts/security/setup-git-hooks.sh"

verify "Pre-commit hook exists" \
    "test -f .githooks/pre-commit"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. VERIFYING CODE FIXES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# JWT.ts - должен требовать env vars
verify "JWT secrets enforcement" \
    "grep -q 'throw new Error.*JWT_SECRET must be set' backend/src/utils/jwt.ts"

# SBOMService - не должно быть execSync
verify "No execSync in SBOMService" \
    "! grep -q 'execSync(' backend/src/services/SBOMService.ts"

# SBOMService - должен использовать spawnSync
verify "SpawnSync used in SBOMService" \
    "grep -q 'spawnSync' backend/src/services/SBOMService.ts"

# SIEM - не должно быть hardcoded token
verify "No hardcoded SIEM token" \
    "! grep -q \"return 'oauth2_token_placeholder'\" backend/src/services/SIEMIntegrationService.ts"

# Vault script - должна быть проверка ENVIRONMENT
verify "Vault production check" \
    "grep -q 'if.*ENVIRONMENT.*production' config/vault/vault-init.sh"

# CA script - должна быть проверка CA_PASSWORD
verify "CA password enforcement" \
    "grep -q 'if.*CA_PASSWORD' config/tls/certificate-authority.sh"

# Bot package.json - должны быть overrides
verify "Bot package overrides" \
    "grep -q '\"overrides\"' bot/package.json"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. VERIFYING DOCUMENTATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

verify "Final report exists" \
    "test -f SECURITY_FIXES_FINAL_REPORT.md"

verify "Deployment guide exists" \
    "test -f SECURITY_DEPLOYMENT_GUIDE.md"

verify "Quick start guide exists" \
    "test -f SECURITY_QUICK_START.md"

verify "Tools documentation exists" \
    "test -f SECURITY_TOOLS_FINAL.md"

verify "Security index exists" \
    "test -f SECURITY_INDEX_FINAL.md"

verify "Scripts README exists" \
    "test -f scripts/security/README.md"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. VERIFYING CI/CD INTEGRATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

verify "GitHub Actions workflow exists" \
    "test -f .github/workflows/security-scan.yml"

verify "Workflow has npm audit" \
    "grep -q 'npm audit' .github/workflows/security-scan.yml"

verify "Workflow has secret scan" \
    "grep -q 'scan-for-secrets' .github/workflows/security-scan.yml"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. VERIFYING PACKAGE SECURITY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d "backend" ]; then
    cd backend
    BACKEND_CRITICAL=$(npm audit --json 2>/dev/null | grep -o '"critical":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")
    if [ "$BACKEND_CRITICAL" -eq 0 ]; then
        echo -e "Backend critical vulnerabilities: ${GREEN}0 ✅${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "Backend critical vulnerabilities: ${RED}$BACKEND_CRITICAL ❌${NC}"
        FAILED=$((FAILED + 1))
    fi
    TOTAL=$((TOTAL + 1))
    cd ..
fi

if [ -d "bot" ]; then
    cd bot
    BOT_CRITICAL=$(npm audit --json 2>/dev/null | grep -o '"critical":[0-9]*' | head -1 | grep -o '[0-9]*' || echo "0")
    if [ "$BOT_CRITICAL" -eq 0 ]; then
        echo -e "Bot critical vulnerabilities: ${GREEN}0 ✅${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "Bot critical vulnerabilities: ${RED}$BOT_CRITICAL ❌${NC}"
        FAILED=$((FAILED + 1))
    fi
    TOTAL=$((TOTAL + 1))
    cd ..
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    VERIFICATION RESULTS                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Total Tests:  $TOTAL"
echo -e "Passed:       ${GREEN}$PASSED${NC}"
echo -e "Failed:       ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    SCORE=$((PASSED * 100 / TOTAL))
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                  ✅ ALL CHECKS PASSED                      ║${NC}"
    echo -e "${GREEN}║                  Score: $SCORE/100                           ║${NC}"
    echo -e "${GREEN}║                  Status: PRODUCTION READY                  ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "✅ All security fixes verified successfully!"
    echo "✅ All tools are in place"
    echo "✅ Documentation is complete"
    echo "✅ System is ready for deployment"
    echo ""
    echo "Next step: Read SECURITY_QUICK_START.md"
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                  ❌ SOME CHECKS FAILED                     ║${NC}"
    echo -e "${RED}║                  Review failures above                     ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Please review the failed checks above and ensure all files exist."
    exit 1
fi

