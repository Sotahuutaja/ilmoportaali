const express = require('express');
const pool = require('./db');
const { securityHeaders, cors } = require('./middleware/security');
const { initDb } = require('./initDb');
const { initPaymentSchema } = require('./initPaymentSchema');
const { processPendingEmails } = require('./services/emailWorker');

// Fail fast if critical environment variables are missing
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set.');
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 3000;

app.use(securityHeaders);
app.use(cors);
app.use(express.json());

// Parse cookies from Cookie header
app.use((req, res, next) => {
  const cookieHeader = req.headers.cookie;
  req.cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      req.cookies[name] = decodeURIComponent(value);
    });
  }
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events/:eventId/products', require('./routes/products'));
app.use('/api/events', require('./routes/events').router);
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/users', require('./routes/users'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/webhooks', require('./routes/webhooks'));

app.get('/', (req, res) => {
  res.json({ message: 'Ilmoportaali API' });
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'unreachable' });
  }
});

// 404 — no route matched
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

// Global error handler — catches any unhandled error thrown in a route
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'An unexpected error occurred' });
});

app.listen(port, async () => {
  console.log(`Server running on port ${port}`);

  // Initialize database indexes in background
  try {
    await initDb();
  } catch (err) {
    console.error('Database initialization failed (non-blocking):', err.message);
    // Don't crash the server, just log the error
  }

  // Initialize payment schema in background
  try {
    await initPaymentSchema();
  } catch (err) {
    console.error('Payment schema initialization failed (non-blocking):', err.message);
    // Don't crash the server, just log the error
  }

  // Start email worker to process queued emails
  try {
    console.log('[EMAIL] Starting email worker...');
    // Process pending emails immediately on startup
    await processPendingEmails(10);

    // Then process emails every 30 seconds
    setInterval(async () => {
      try {
        await processPendingEmails(10);
      } catch (err) {
        console.error('[EMAIL WORKER] Periodic processing error:', err.message);
        // Don't crash the server, just log the error
      }
    }, 30000);

    console.log('[EMAIL] Email worker started (processes every 30 seconds)');
  } catch (err) {
    console.error('Email worker initialization failed (non-blocking):', err.message);
    // Don't crash the server, just log the error
  }
});