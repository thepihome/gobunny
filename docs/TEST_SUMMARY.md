# Test Suite Summary

## Overview
The GoBunny application has a comprehensive test suite covering backend API functionality, frontend React components, and end-to-end scenarios.

## Test Structure

### Backend Tests
**Location:** `backend/src/routes/__tests__/candidates.test.js`

**Framework:** Jest with ES modules

**Test Coverage:**
- Filter condition building (`buildFilterConditions` function)
- Empty/null filter handling
- Text field filtering (LIKE, exact match)
- Numeric field filtering (comparison operators: >, <, >=, <=)
- Boolean field filtering
- Multiple condition handling
- Invalid field name handling
- Empty value handling
- LIKE pattern handling with/without wildcards
- Invalid numeric value handling

**To Run:**
```bash
cd backend
npm test
```

### Frontend Tests

#### 1. Filter Parser Tests
**Location:** `frontend/src/utils/filterParser.test.js`

**Test Coverage:**
- Query syntax parsing (`parseQueryValue` function)
- Exact match syntax: `=value`
- LIKE pattern syntax: `like pattern%`
- Comparison operators: `>1`, `<5`, `>=10`, `<=20`
- Default LIKE for plain text
- Empty/null value handling
- Whitespace trimming
- Case-insensitive LIKE matching

#### 2. Candidates Page Tests
**Location:** `frontend/src/pages/__tests__/Candidates.test.js`

**Test Coverage:**
- Filter panel visibility
- Add/remove filter conditions
- Clear all filters
- Query syntax parsing in UI
- Field selection and input types

**To Run:**
```bash
cd frontend
npm test
```

### End-to-End Tests
**Location:** `tests/e2e/candidates-filters.e2e.test.js`

**Test Coverage (Planned):**
- Filter UI interactions
- Query syntax parsing
- Backend filter processing
- Filter persistence in URL
- KPI saving with filters
- Performance (debouncing)
- Edge cases (special characters, long values, etc.)

**Note:** E2E tests are currently scaffolded and need implementation.

## Running All Tests

### Option 1: Use the test runner script
```bash
./run-tests.sh
```

### Option 2: Run individually
```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

## Test Files Summary

| File | Type | Status |
|------|------|--------|
| `backend/src/routes/__tests__/candidates.test.js` | Unit | ✅ Implemented |
| `frontend/src/utils/filterParser.test.js` | Unit | ✅ Implemented |
| `frontend/src/pages/__tests__/Candidates.test.js` | Integration | ✅ Implemented |
| `tests/e2e/candidates-filters.e2e.test.js` | E2E | ⚠️ Scaffolded |

## Key Test Scenarios

### Backend Filter Logic
1. **Text Fields:**
   - LIKE pattern matching with wildcards
   - Exact match with `=` operator
   - NULL value handling

2. **Numeric Fields:**
   - Comparison operators (>, <, >=, <=)
   - Invalid value handling
   - NULL value handling

3. **Boolean Fields:**
   - True/false value conversion
   - NULL handling for false values

4. **Security:**
   - Invalid field name filtering
   - SQL injection prevention (parameterized queries)

### Frontend Filter UI
1. **User Interactions:**
   - Show/hide filter panel
   - Add multiple filter conditions
   - Remove individual filters
   - Clear all filters

2. **Query Syntax:**
   - Automatic operator detection from input
   - Support for explicit operators
   - Default LIKE behavior for plain text

## Dependencies

### Backend
- Jest ^29.7.0
- @jest/globals ^29.7.0

### Frontend
- react-scripts 5.0.1
- @testing-library/react ^13.4.0
- @testing-library/jest-dom ^5.16.5
- @testing-library/user-event ^13.5.0
- Jest ^27.5.1

## Notes

- Backend tests use ES modules (`--experimental-vm-modules`)
- Frontend tests use React Testing Library for component testing
- All tests should be run in a test environment with proper database setup
- E2E tests require a running application instance

