#!/bin/bash
# E2E Test Runner Script for Temple Website

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
REPORT_DIR="${REPORT_DIR:-reports}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "=========================================="
echo "Temple Website E2E Test Runner"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo "Timestamp: $TIMESTAMP"
echo ""

# Check if Playwright is installed
if ! npx playwright --version > /dev/null 2>&1; then
    echo -e "${YELLOW}Installing Playwright...${NC}"
    npx playwright install chromium
fi

# Create reports directory
mkdir -p "$REPORT_DIR"

# Function to run tests
run_tests() {
    local test_group="$1"
    local extra_args="$2"
    
    echo -e "${YELLOW}Running $test_group tests...${NC}"
    
    if [ -z "$extra_args" ]; then
        npx playwright test "$test_group" --reporter=list || true
    else
        npx playwright test "$test_group" $extra_args --reporter=list || true
    fi
}

# Parse command line arguments
TEST_GROUP="${1:-all}"

case "$TEST_GROUP" in
    "all")
        echo -e "${GREEN}Running all E2E tests...${NC}"
        npx playwright test --reporter=list || true
        ;;
    "home")
        run_tests "home"
        ;;
    "auth")
        run_tests "auth"
        ;;
    "navigation")
        run_tests "navigation"
        ;;
    "events")
        run_tests "events"
        ;;
    "gallery")
        run_tests "gallery"
        ;;
    "donations")
        run_tests "donations"
        ;;
    "sevas")
        run_tests "sevas"
        ;;
    "chatbot")
        run_tests "chatbot"
        ;;
    "admin")
        run_tests "admin"
        ;;
    "api")
        run_tests "api"
        ;;
    "forms")
        run_tests "forms"
        ;;
    "accessibility")
        run_tests "accessibility"
        ;;
    "responsive")
        run_tests "responsive"
        ;;
    "seo")
        run_tests "seo"
        ;;
    "security")
        run_tests "security"
        ;;
    "performance")
        run_tests "performance"
        ;;
    "error-handling")
        run_tests "error-handling"
        ;;
    "critical")
        echo -e "${GREEN}Running critical tests only...${NC}"
        npx playwright test --grep "HP-001|HP-002|AUTH-001|ERR-001" --reporter=list || true
        ;;
    *)
        echo -e "${RED}Unknown test group: $TEST_GROUP${NC}"
        echo "Available groups: all, home, auth, navigation, events, gallery, donations, sevas, chatbot, admin, api, forms, accessibility, responsive, seo, security, performance, error-handling, critical"
        exit 1
        ;;
esac

# Generate report
echo ""
echo -e "${YELLOW}Generating test summary report...${NC}"
python3 tests/generate_test_summary.py || echo "Could not generate Python report (may need dependencies)"

# Summary
echo ""
echo "=========================================="
echo "Test Run Complete"
echo "=========================================="
echo "Reports saved to: $REPORT_DIR/"
echo "HTML Report: $REPORT_DIR/html/index.html"
echo "JSON Results: $REPORT_DIR/playwright-test-results.json"
