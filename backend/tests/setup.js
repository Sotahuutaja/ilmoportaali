/**
 * Jest setup - runs before all tests
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.APP_URL = 'http://localhost:3000';

jest.setTimeout(10000);

afterEach(() => {
  jest.clearAllMocks();
});
