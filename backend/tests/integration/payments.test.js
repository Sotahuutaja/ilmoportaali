/**
 * Payment Integration Tests
 * Critical tests for payment processing
 */

const request = require('supertest');
const pool = require('../../src/db');

// Mock Stripe service
jest.mock('../../src/services/stripeService', () => ({
  createPaymentIntent: jest.fn(async (_, amountCents, email) => ({
    id: 'pi_test_' + Date.now(),
    client_secret: 'pi_secret_test',
    amount: amountCents,
    status: 'succeeded',
    metadata: { email }
  })),
  getPaymentIntent: jest.fn(async (id) => ({
    id,
    status: 'succeeded',
    amount: 5000,
    metadata: { email: 'test@example.com' }
  })),
  isConfigured: jest.fn(() => false)
}));

// Mock email service
jest.mock('../../src/services/emailService', () => ({
  sendRegistrationConfirmation: jest.fn(async () => {}),
  sendRegistrationCancellation: jest.fn(async () => {})
}));

describe('Payment Integration Tests', () => {
  let app;
  let server;
  let eventId;
  let productId;

  beforeAll(async () => {
    app = require('../../src/index');

    // Start server but keep reference to close it
    server = app.listen(3001, () => {});

    const eventResult = await pool.query(
      `INSERT INTO events (id, title, created_by, starts_at, ends_at, registration_start, registration_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['test_event_' + Date.now(), 'Test Event', 'creator_123',
       new Date(Date.now() + 86400000),
       new Date(Date.now() + 172800000),
       new Date(Date.now() - 3600000),
       new Date(Date.now() + 86400000)]
    );
    eventId = eventResult.rows[0].id;

    const productResult = await pool.query(
      `INSERT INTO event_products (event_id, name, price, fields)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [eventId, 'Test Product', 25.00, '[]']
    );
    productId = productResult.rows[0].id;
  });

  afterAll(async () => {
    // Clean up database
    await pool.query('DELETE FROM registrations WHERE event_id = $1', [eventId]);
    await pool.query('DELETE FROM event_products WHERE event_id = $1', [eventId]);
    await pool.query('DELETE FROM events WHERE id = $1', [eventId]);

    // Close server and pool
    if (server) {
      server.close();
    }
    await pool.end();

    // Force exit if still pending
    process.exit(0);
  });

  test('should create payment intent with valid products', async () => {
    const response = await request(app)
      .post('/api/payments/create-payment-intent')
      .set('Authorization', 'Bearer test_token')
      .send({
        eventId,
        products: [{ product_id: productId, quantity: 1, field_values: {} }],
        teamId: null,
        comments: 'Test'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('paymentIntentId');
  });

  test('should reject negative quantities', async () => {
    const response = await request(app)
      .post('/api/payments/create-payment-intent')
      .set('Authorization', 'Bearer test_token')
      .send({
        eventId,
        products: [{ product_id: productId, quantity: -1, field_values: {} }]
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('positive');
  });
});
