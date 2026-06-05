# GitHub Actions Testing

Tests run automatically in GitHub Actions before deploying to production.

## How It Works

**Every push to main:**
1. GitHub Actions starts
2. PostgreSQL test database spins up
3. Migrations run
4. Jest tests execute
5. If tests pass ✓ → Build & Deploy
6. If tests fail ✗ → Block deployment, alert developer

## Test Files

Location: `backend/tests/`

- `setup.js` — Jest configuration and test database connection
- `integration/payments.test.js` — Critical payment processing tests

## What Gets Tested

✓ Payment intent creation  
✓ Quantity validation  
✓ Error handling  

## Local Testing

You can also run tests locally before pushing:

```bash
cd backend
npm ci
npm test
```

## Workflow File

`.github/workflows/deploy.yml` now includes:
- `test-backend` job — Runs tests before deployment
- `build-deploy-backend` — Waits for tests to pass

## If Tests Fail

1. GitHub Actions shows red ✗ on the commit
2. Deployment is blocked
3. Developer receives notification
4. Fix code and push again
5. Tests run automatically on new push

## Adding More Tests

Add new test files to `backend/tests/integration/`:
- File must end with `.test.js`
- Jest auto-discovers and runs all tests

Example:
```javascript
// backend/tests/integration/my-feature.test.js
describe('My Feature', () => {
  test('should do X', async () => {
    // test code
  });
});
```

## Test Database

Tests use temporary PostgreSQL container:
- Created fresh for each workflow run
- Automatically cleaned up
- No persistent data
- No conflicts with production

## Performance

Tests run in ~2-3 minutes, adding minimal time to deployment pipeline.
