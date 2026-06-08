# Product Option Price Issue - Debug Guide

## Problem
When a registration confirmation email is sent, product option prices are not being displayed correctly. For example, a T-shirt with Size L should show €0.52 but shows €0.51 instead.

## Investigation Done

### 1. Code Review
- **Frontend**: Correctly calculates prices with option overrides using `getProductPriceWithOptions()`
- **Backend Price Calculation**: `calculateProductPrice()` in registrations.js correctly applies field option price overrides
- **Email Rendering**: `emailWorker.js` has `getProductPriceWithOptions()` to recalculate prices when sending emails

### 2. Identified Issues

#### Issue 1: JSON Parsing (FIXED)
- `field_values` from `registration_products` table comes as JSON string from database
- Added `JSON.parse()` with try-catch to handle string conversion ✓

#### Issue 2: Field Data Type Handling (FIXED)
- `fields` column from `event_products` is JSONB, automatically parsed by node-postgres
- Option matching logic was correct but defensive code added

#### Issue 3: Guest Products Data Bug (FIXED)
- Line 313 in emailWorker.js was passing `p.field_values` (unparsed) instead of `fieldValues` (parsed) to transformFieldValues
- Changed to pass `fieldValues` (the parsed version) ✓

### 3. Logging Added

Comprehensive debug logging added to `backend/src/services/emailWorker.js`:

#### Captain Products Section (lines ~210-250):
```
[EMAIL WORKER] Fetched X registration products...
  - Raw query results from database
  
[EMAIL WORKER PRICE DEBUG] Product: {name}
  - basePrice: {price} (type: {type})
  - p.fields type: {type}, isArray: {bool}
  - p.fields raw: {raw_data}
  - fieldValues: {parsed_field_values}
  - Fields structure: {field_definitions}
    
    - Field "{label}" (id: {id}), selectedValue: {value}
      Checking option: ... => optVal="{opt_val}" vs selectedValue="{sel_val}" => match: {bool}
      ✓/✗ {result}
    FINAL PRICE: €{price}
```

#### Guest Products Section:
Similar logging with [GUEST] prefix

## What the Logs Will Show

When you register with a product that has option price overrides and the confirmation email is sent, the logs will reveal:

1. **Is fields data being fetched?**
   - Look for "p.fields raw:" and "Fields structure:"
   - Should show array of field objects with options

2. **Are field_values being parsed correctly?**
   - Look for "fieldValues:" line
   - Should show object like `{"field_id_123": "L"}`

3. **Are options being matched?**
   - Look for "Checking option:" lines
   - Should show the option matching logic finding the right option

4. **Does the option have a price?**
   - Look for "option.price=" in logs
   - Should show 0.52 for Size L

5. **Why is the final price wrong?**
   - Look for "FINAL PRICE:" line
   - If it's €0.51 instead of €0.52:
     - Either option.price is 0.51 in database
     - Or option.price is null/undefined and fallback to base price happens
     - Or fields are empty/malformed

## Next Steps

1. **Rebuild Docker containers** to include new logging
2. **Trigger a registration** with a product that has option price overrides
3. **Check backend logs** when the confirmation email is queued
4. **Look for the debug output** showing the exact data structure and price calculation
5. **Share logs** if the issue is still occurring - they will pinpoint exactly where the price is wrong

## Files Modified

- `backend/src/services/emailWorker.js` - Added comprehensive logging for price calculation
  - Fixed bug on line 313 passing unparsed fieldValues
  - Added JSON.parse for field_values (was already there)
  - Added detailed logging at every step of price calculation

## Expected Behavior After Fix

When email is sent for a registration with:
- Product: "T-paita" base price €0.51
- Field: "Size" with options:
  - S: €0.50
  - L: €0.52

The email should show:
- T-paita Size L: €0.52 ✓

Not:
- T-paita Size L: €0.51 ✗
