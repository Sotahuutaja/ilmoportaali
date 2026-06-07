# GitHub Actions Testing

Tests run automatically in GitHub Actions before deploying to production.

## How It Works

**Every push to main:**
1. GitHub Actions triggers
2. Install dependencies
3. Run Jest tests (validation logic)
4. If tests pass ✓ → Build & Deploy
5. If tests fail ✗ → Block deployment, alert developer

## Test Files

Location: `backend/tests/`

- `setup.js` — Jest configuration and environment setup
- `integration/payments.test.js` — Payment validation tests

## What Gets Tested

✓ Quantity validation (must be positive integer)  
✓ Field value validation (must be object or null)  
✓ Amount calculation (correct math)  
✓ Amount validation (must be ≥ €0.01)  

## Current Tests

**Payment Validation:**
- `should reject negative quantities`
- `should reject non-integer quantities`
- `should accept valid quantities`
- `should reject invalid field_values`
- `should accept valid field_values`
- `should accept null field_values`
- `should calculate amount correctly`
- `should reject zero amount`
- `should accept valid amount`

## Local Testing

You can run tests locally before pushing:

```bash
cd backend
npm install
npm test
```

## Workflow File

`.github/workflows/deploy.yml` includes:
- `test-backend` job — Runs Jest tests
- `build-deploy-backend` — Waits for tests to pass, then builds and deploys

## If Tests Fail

1. GitHub Actions shows red ✗ on the commit
2. Deployment is blocked
3. GitHub notifies you
4. Fix code and push again
5. Tests run automatically on new push

## Adding More Tests

Add new test files to `backend/tests/integration/`:
- File must end with `.test.js`
- Jest auto-discovers and runs all tests

Example:
```javascript
// backend/tests/integration/inventory.test.js
test('should prevent overselling', () => {
  const remaining = 5;
  const requested = 10;
  const canSell = requested <= remaining;
  expect(canSell).toBe(false);
});
```

## Performance

Tests run in ~30-60 seconds, adding minimal time to deployment pipeline.

## Notes

Tests are focused on validation logic and don't require:
- Database connections
- Express app startup
- External services
- Complex setup

This keeps tests fast and reliable.
