# Candidate Filter Test Plan

## Test Scenarios

### 1. Basic Filter Operations
- [ ] Add single filter condition
- [ ] Add multiple filter conditions
- [ ] Remove individual filter condition
- [ ] Clear all filters
- [ ] Filter panel show/hide toggle

### 2. Field Type Handling
- [ ] Text fields (First Name, Last Name, Email, etc.)
  - [ ] LIKE search (default)
  - [ ] Exact match with `=`
  - [ ] Pattern match with `like pattern%`
- [ ] Number fields (Years of Experience)
  - [ ] Equal to (`=`)
  - [ ] Greater than (`>`)
  - [ ] Less than (`<`)
  - [ ] Greater than or equal (`>=`)
  - [ ] Less than or equal (`<=`)
- [ ] Select fields (Availability)
  - [ ] Dropdown selection
  - [ ] All options work correctly
- [ ] Boolean fields (Willing to Relocate, Status)
  - [ ] Yes/No selection
  - [ ] True/False handling

### 3. Query Syntax Parsing
- [ ] `=value` → exact match
- [ ] `like Data%` → LIKE pattern
- [ ] `>1` → greater than
- [ ] `<5` → less than
- [ ] `>=10` → greater than or equal
- [ ] `<=20` → less than or equal
- [ ] Plain text → default LIKE
- [ ] Whitespace handling
- [ ] Special characters (%, _, quotes)

### 4. Backend Filter Processing
- [ ] Single condition filtering
- [ ] Multiple conditions (AND logic)
- [ ] NULL value handling
- [ ] SQL injection prevention
- [ ] Parameter binding correctness
- [ ] Field mapping accuracy

### 5. Filter Persistence
- [ ] URL parameter encoding/decoding
- [ ] Filter restoration on page reload
- [ ] URL updates on filter changes
- [ ] Browser back/forward navigation

### 6. Performance
- [ ] Debouncing (300ms for values, 500ms for URL)
- [ ] No page refresh on input
- [ ] API call optimization
- [ ] Input focus maintained

### 7. Edge Cases
- [ ] Empty filter conditions
- [ ] Invalid field names
- [ ] Invalid values (non-numeric for number fields)
- [ ] Very long filter values
- [ ] Special characters in values
- [ ] Multiple filters with same field

### 8. KPI Integration
- [ ] Save filters as KPI
- [ ] KPI uses new conditions format
- [ ] Click KPI to apply filters
- [ ] KPI calculation with filters

### 9. Admin vs Consultant Views
- [ ] Admin sees all candidates
- [ ] Consultant sees assigned candidates only
- [ ] Filters work correctly for both roles

### 10. Sorting Integration
- [ ] Filters work with column sorting
- [ ] Sort persists when filters change
- [ ] Filters persist when sort changes

