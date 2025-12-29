# How to Run Tests

## Prerequisites

1. **Install Dependencies:**
   ```bash
   # Install root dependencies
   npm install
   
   # Install backend dependencies
   cd backend
   npm install
   
   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

2. **Database Setup:**
   - Ensure your test database is configured
   - Backend tests may require database access for integration tests

## Running Tests

### Backend Tests

Navigate to the backend directory and run:

```bash
cd backend
npm test
```

**What it tests:**
- `buildFilterConditions` function in `src/routes/candidates.js`
- Filter condition building for text, number, and boolean fields
- SQL query generation with proper parameterization
- Edge cases (empty values, invalid fields, etc.)

**Expected Output:**
```
PASS  src/routes/__tests__/candidates.test.js
  buildFilterConditions
    ✓ should handle empty filter conditions
    ✓ should handle null filter conditions
    ✓ should build text field LIKE condition
    ✓ should build text field exact match condition
    ... (more tests)
```

### Frontend Tests

Navigate to the frontend directory and run:

```bash
cd frontend
npm test
```

**Note:** This will start Jest in watch mode. To run once and exit:

```bash
npm test -- --watchAll=false
```

**What it tests:**
1. **Filter Parser** (`src/utils/filterParser.test.js`):
   - Query syntax parsing
   - Operator detection (=, like, >, <, >=, <=)
   - Default LIKE behavior

2. **Candidates Page** (`src/pages/__tests__/Candidates.test.js`):
   - Filter panel UI interactions
   - Add/remove filter conditions
   - Clear filters functionality

**Expected Output:**
```
PASS  src/utils/filterParser.test.js
  parseQueryValue
    ✓ should parse exact match with =
    ✓ should parse LIKE pattern
    ... (more tests)

PASS  src/pages/__tests__/Candidates.test.js
  Candidates Filter Functionality
    ✓ should render filter panel when show filters is clicked
    ... (more tests)
```

### Run All Tests

You can use the provided test runner script:

```bash
./run-tests.sh
```

Or run them manually in sequence:

```bash
# Terminal 1: Backend tests
cd backend && npm test

# Terminal 2: Frontend tests  
cd frontend && npm test -- --watchAll=false
```

## Test Coverage

### Backend Test Coverage

The backend tests cover:
- ✅ Empty/null filter handling
- ✅ Text field filtering (LIKE, exact match)
- ✅ Numeric field filtering (>, <, >=, <=)
- ✅ Boolean field filtering
- ✅ Multiple conditions
- ✅ Invalid field handling
- ✅ Empty value handling
- ✅ LIKE pattern handling

### Frontend Test Coverage

The frontend tests cover:
- ✅ Query syntax parsing
- ✅ Filter UI interactions
- ✅ Filter condition management
- ✅ Field type detection

## Troubleshooting

### Issue: "Cannot find module 'jest'"

**Solution:** Install dependencies:
```bash
cd backend
npm install
```

### Issue: "Experimental VM modules" error

**Solution:** The backend uses ES modules. Ensure you're using Node.js 12+ and the test script includes `--experimental-vm-modules`.

### Issue: Tests fail with database errors

**Solution:** 
1. Check database configuration in `backend/config/database.js`
2. Ensure test database is set up
3. Some tests may require mock database connections

### Issue: Frontend tests fail to start

**Solution:**
1. Ensure all frontend dependencies are installed
2. Check that `react-scripts` is properly installed
3. Try clearing cache: `npm test -- --clearCache`

## Test Files Location

```
gobunny/
├── backend/
│   └── src/
│       └── routes/
│           └── __tests__/
│               └── candidates.test.js
├── frontend/
│   └── src/
│       ├── utils/
│       │   └── filterParser.test.js
│       └── pages/
│           └── __tests__/
│               └── Candidates.test.js
└── tests/
    └── e2e/
        └── candidates-filters.e2e.test.js (scaffolded)
```

## Continuous Integration

For CI/CD pipelines, use:

```bash
# Backend tests (non-interactive)
cd backend && npm test -- --ci

# Frontend tests (non-interactive)
cd frontend && npm test -- --watchAll=false --ci
```

## Next Steps

1. **Implement E2E Tests:** The `tests/e2e/candidates-filters.e2e.test.js` file is scaffolded but needs implementation
2. **Add More Unit Tests:** Consider adding tests for other routes and components
3. **Increase Coverage:** Aim for >80% code coverage on critical paths

