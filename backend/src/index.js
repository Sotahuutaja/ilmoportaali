const express = require('express');
const pool = require('./db');
const { securityHeaders, cors } = require('./middleware/security');

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

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events/:eventId/products', require('./routes/products'));
app.use('/api/events', require('./routes/events').router);
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/users', require('./routes/users'));
app.use('/api/teams', require('./routes/teams'));

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

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});