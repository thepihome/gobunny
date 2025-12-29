# Test Suite Documentation

## Overview
This directory contains comprehensive end-to-end and integration tests for the GoDash application, with a focus on candidate filtering functionality.

## Test Structure

### Unit Tests
- `frontend/src/utils/filterParser.test.js` - Tests for query syntax parsing
- `backend/src/routes/__tests__/candidates.test.js` - Tests for backend filter logic

### Integration Tests
- `frontend/src/pages/__tests__/Candidates.test.js` - Tests for Candidates page filter UI

### End-to-End Tests
- `tests/e2e/candidates-filters.e2e.test.js` - Complete E2E test scenarios

## Running Tests

### Frontend Tests
```bash
cd frontend
npm test
```

### Backend Tests
```bash
cd backend
npm test
```

### All Tests
```bash
npm run test:all
```

## Test Coverage

### Filter Functionality Tests
1. **UI Tests**
   - Filter panel visibility
   - Add/remove filter conditions
   - Clear all filters
   - Field type detection

2. **Query Syntax Tests**
   - Exact match: `=value`
   - LIKE pattern: `like pattern%`
   - Comparison operators: `>1`, `<5`, `>=10`, `<=20`
   - Default LIKE for plain text

3. **Backend Filter Tests**
   - Text field filtering (LIKE, exact)
   - Number field filtering (comparisons)
   - Boolean field filtering
   - Multiple conditions (AND logic)
   - NULL value handling
   - SQL injection prevention

4. **Integration Tests**
   - Filter persistence in URL
   - Debouncing behavior
   - API call optimization
   - KPI saving with filters

## Test Data
Tests use mock data and test database fixtures. Ensure test database is properly configured before running tests.

