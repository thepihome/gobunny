#!/bin/bash

# Test Runner Script for GoBunny Application
# This script runs all tests in the application

set -e

echo "=========================================="
echo "GoBunny Test Suite"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track test results
BACKEND_PASSED=false
FRONTEND_PASSED=false

# Run Backend Tests
echo -e "${YELLOW}Running Backend Tests...${NC}"
echo "----------------------------------------"
cd backend
if npm test; then
    echo -e "${GREEN}✓ Backend tests passed${NC}"
    BACKEND_PASSED=true
else
    echo -e "${RED}✗ Backend tests failed${NC}"
    BACKEND_PASSED=false
fi
cd ..

echo ""
echo "----------------------------------------"
echo ""

# Run Frontend Tests
echo -e "${YELLOW}Running Frontend Tests...${NC}"
echo "----------------------------------------"
cd frontend
if npm test -- --watchAll=false --coverage=false; then
    echo -e "${GREEN}✓ Frontend tests passed${NC}"
    FRONTEND_PASSED=true
else
    echo -e "${RED}✗ Frontend tests failed${NC}"
    FRONTEND_PASSED=false
fi
cd ..

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
if [ "$BACKEND_PASSED" = true ] && [ "$FRONTEND_PASSED" = true ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed ✗${NC}"
    exit 1
fi

