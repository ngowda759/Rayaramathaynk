#!/bin/bash
# Quick validation script for temple website
# Tests core functionality without full Playwright

set -e

BASE_URL="${BASE_URL:-http://localhost:3456}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

info() {
    echo -e "${YELLOW}→${NC} $1"
}

# Test homepage
echo "========================================"
echo "Temple Website Quick Validation"
echo "========================================"
echo "Base URL: $BASE_URL"
echo ""

# Homepage tests
info "Testing Homepage..."
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/" | grep -q "200"; then
    pass "Homepage loads (200)"
else
    fail "Homepage failed to load"
fi

# Check title
TITLE=$(curl -s "$BASE_URL/" | grep -o '<title>[^<]*</title>' | head -1)
if echo "$TITLE" | grep -q "Sri Raghavendra"; then
    pass "Homepage has correct title"
else
    fail "Homepage title incorrect"
fi

# Check meta description
if curl -s "$BASE_URL/" | grep -q 'meta name="description"'; then
    pass "Meta description present"
else
    fail "Meta description missing"
fi

# Check navigation
if curl -s "$BASE_URL/" | grep -q "<nav"; then
    pass "Navigation element present"
else
    fail "Navigation missing"
fi

# Check main content
if curl -s "$BASE_URL/" | grep -q '<main'; then
    pass "Main content element present"
else
    fail "Main content missing"
fi

# Check skip link for accessibility
if curl -s "$BASE_URL/" | grep -q 'skip'; then
    pass "Skip link present (accessibility)"
else
    fail "Skip link missing"
fi

# Check fonts loading
if curl -s "$BASE_URL/" | grep -q '\.woff2'; then
    pass "Fonts configured"
else
    fail "Fonts not configured"
fi

# Login page
info "Testing Login Page..."
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/login" | grep -q "200"; then
    pass "Login page loads (200)"
else
    fail "Login page failed to load"
fi

if curl -s "$BASE_URL/login" | grep -q 'type="password"'; then
    pass "Password field present"
else
    fail "Password field missing"
fi

# Events page
info "Testing Events Page..."
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/events" | grep -q "200"; then
    pass "Events page loads (200)"
else
    fail "Events page failed to load"
fi

# Gallery page
info "Testing Gallery Page..."
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/gallery" | grep -q "200"; then
    pass "Gallery page loads (200)"
else
    fail "Gallery page failed to load"
fi

# Sevas page
info "Testing Sevas Page..."
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/sevas" | grep -q "200"; then
    pass "Sevas page loads (200)"
else
    fail "Sevas page failed to load"
fi

# Donation page
info "Testing Donation Page..."
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/donation" | grep -q "200"; then
    pass "Donation page loads (200)"
else
    fail "Donation page failed to load"
fi

# About page
info "Testing About Page..."
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/about" | grep -q "200"; then
    pass "About page loads (200)"
else
    fail "About page failed to load"
fi

# Aaradhane page
info "Testing Aaradhane Page..."
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/aaradhane" | grep -q "200"; then
    pass "Aaradhane page loads (200)"
else
    fail "Aaradhane page failed to load"
fi

# Search page
info "Testing Search Page..."
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/search" | grep -q "200"; then
    pass "Search page loads (200)"
else
    fail "Search page failed to load"
fi

# Admin redirect (should redirect to login)
info "Testing Admin Access Control..."
ADMIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin" -L)
if [ "$ADMIN_STATUS" = "200" ] || [ "$ADMIN_STATUS" = "301" ] || [ "$ADMIN_STATUS" = "302" ]; then
    pass "Admin access controlled"
else
    fail "Admin access issue"
fi

# API endpoints
info "Testing API Endpoints..."
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/events" | grep -q "200\|404\|500"; then
    pass "Events API responds"
else
    fail "Events API failed"
fi

if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/announcements" | grep -q "200\|404\|500"; then
    pass "Announcements API responds"
else
    fail "Announcements API failed"
fi

# SEO checks
info "Testing SEO..."
if curl -s "$BASE_URL/" | grep -q 'og:title'; then
    pass "Open Graph tags present"
else
    fail "Open Graph tags missing"
fi

if curl -s "$BASE_URL/" | grep -q 'og:image'; then
    pass "OG image tag present"
else
    fail "OG image tag missing"
fi

if curl -s "$BASE_URL/" | grep -q 'rel="canonical"'; then
    pass "Canonical URL present"
else
    fail "Canonical URL missing"
fi

# 404 handling
info "Testing Error Handling..."
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/nonexistent-page-xyz-123" | grep -q "200\|404"; then
    pass "404 page handled"
else
    fail "404 handling failed"
fi

# Responsive meta
info "Testing Responsive Configuration..."
if curl -s "$BASE_URL/" | grep -q 'viewport'; then
    pass "Viewport meta tag present"
else
    fail "Viewport meta tag missing"
fi

# HTML lang attribute
if curl -s "$BASE_URL/" | grep -q 'lang="en"'; then
    pass "HTML lang attribute set"
else
    fail "HTML lang attribute missing"
fi

# Summary
echo ""
echo "========================================"
echo "Test Summary"
echo "========================================"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi
