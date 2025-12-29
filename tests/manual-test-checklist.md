# Manual Test Checklist for Candidate Filters

## Pre-Test Setup
- [ ] Clear browser cache
- [ ] Login as admin
- [ ] Ensure test candidates exist with various data

## Test 1: Basic Filter UI
- [ ] Navigate to Candidates page
- [ ] Click "Show Filters" button
- [ ] Verify filter panel appears
- [ ] Verify "Add Filter" button is visible
- [ ] Click "Add Filter"
- [ ] Verify new filter row appears with:
  - [ ] Field dropdown
  - [ ] Value input
  - [ ] Remove button

## Test 2: Text Field Filtering
- [ ] Add filter: First Name = "John"
- [ ] Verify candidates with first_name containing "John" appear
- [ ] Change to exact match: First Name = "=John"
- [ ] Verify only exact matches appear
- [ ] Change to pattern: First Name = "like J%"
- [ ] Verify candidates with names starting with "J" appear
- [ ] Test with Email field
- [ ] Test with City field
- [ ] Test with Company field

## Test 3: Number Field Filtering
- [ ] Add filter: Years of Experience
- [ ] Select operator ">" and value "5"
- [ ] Verify candidates with >5 years appear
- [ ] Test operators: <, >=, <=, =
- [ ] Verify all operators work correctly

## Test 4: Select Field Filtering
- [ ] Add filter: Availability
- [ ] Select "available" from dropdown
- [ ] Verify only available candidates appear
- [ ] Test all availability options

## Test 5: Boolean Field Filtering
- [ ] Add filter: Willing to Relocate
- [ ] Select "Yes"
- [ ] Verify only candidates willing to relocate appear
- [ ] Select "No"
- [ ] Verify only candidates not willing to relocate appear
- [ ] Test Status field (Active/Inactive)

## Test 6: Multiple Filters (AND Logic)
- [ ] Add filter: City = "San Francisco"
- [ ] Add filter: Years of Experience > 3
- [ ] Verify only candidates matching BOTH conditions appear
- [ ] Add third filter
- [ ] Verify all three conditions are applied

## Test 7: Query Syntax in Text Fields
- [ ] Add filter: First Name
- [ ] Type "=John" → Verify exact match
- [ ] Type "like J%" → Verify pattern match
- [ ] Type "John" → Verify default LIKE (contains)
- [ ] Test with special characters: %, _, quotes

## Test 8: Filter Persistence
- [ ] Add filters
- [ ] Verify URL contains query parameter
- [ ] Copy URL
- [ ] Open in new tab
- [ ] Verify filters are restored
- [ ] Modify filter
- [ ] Verify URL updates (after debounce)

## Test 9: Performance & UX
- [ ] Type rapidly in filter input
- [ ] Verify input remains responsive
- [ ] Verify no page refresh occurs
- [ ] Verify API is called after typing stops (debounce)
- [ ] Verify input maintains focus

## Test 10: Remove & Clear Filters
- [ ] Add multiple filters
- [ ] Remove one filter
- [ ] Verify only that filter is removed
- [ ] Click "Clear All"
- [ ] Verify all filters are removed
- [ ] Verify URL is cleared

## Test 11: Save as KPI
- [ ] Add filters
- [ ] Click "Save as KPI"
- [ ] Enter KPI name
- [ ] Save KPI
- [ ] Verify KPI appears on Dashboard
- [ ] Click on KPI card
- [ ] Verify navigation to Candidates page
- [ ] Verify filters are automatically applied

## Test 12: Sorting with Filters
- [ ] Apply filters
- [ ] Click on column header to sort
- [ ] Verify sorting works with filtered results
- [ ] Verify filters remain applied after sorting

## Test 13: Edge Cases
- [ ] Add filter without selecting field → Verify it's ignored
- [ ] Add filter without entering value → Verify it's ignored
- [ ] Enter invalid number in number field → Verify it's ignored
- [ ] Enter very long text → Verify it works
- [ ] Test with special characters: <, >, &, ', "
- [ ] Test with SQL injection attempts

## Test 14: Admin vs Consultant
- [ ] Login as admin → Verify all candidates visible
- [ ] Apply filters → Verify works correctly
- [ ] Login as consultant → Verify only assigned candidates visible
- [ ] Apply filters → Verify works correctly

## Test 15: Filter with NULL Values
- [ ] Create candidate with NULL city
- [ ] Filter by city → Verify candidate does NOT appear
- [ ] Create candidate with city value
- [ ] Filter by city → Verify candidate appears

## Test 16: Job Roles Integration
- [ ] Navigate to Metadata → Job Roles
- [ ] Add job role "Software Engineer"
- [ ] Navigate to Candidates
- [ ] Edit candidate profile
- [ ] Verify "Software Engineer" appears in Job Title dropdown
- [ ] Select job role from dropdown
- [ ] Save profile
- [ ] Filter by Job Title = "Software Engineer"
- [ ] Verify candidate appears

## Expected Results Summary
- All filters should work correctly
- No page refreshes when typing
- URL updates after debounce
- Filters persist across page reloads
- Multiple filters combine with AND logic
- Query syntax parsing works for all patterns
- KPI saving and loading works
- Sorting works with filters
- No SQL injection vulnerabilities
- NULL values handled correctly

