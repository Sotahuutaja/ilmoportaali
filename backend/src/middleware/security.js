// ─── Security headers ────────────────────────────────────────────────────────
// Replaces the helmet package with the headers that matter for this app.

function securityHeaders(req, res, next) {
  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Disallow embedding in frames (clickjacking protection)
  res.setHeader('X-Frame-Options', 'DENY');
  // Disable the legacy XSS auditor — modern guidance is to turn it off
  res.setHeader('X-XSS-Protection', '0');
  // Limit referrer information sent to third parties
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Restrict access to browser features this app doesn't use
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // Don't advertise the server tech stack
  res.removeHeader('X-Powered-By');
  next();
}

// ─── CORS ────────────────────────────────────────────────────────────────────
// Locks the API to the frontend origin defined in APP_URL.
// Falls back to permissive '*' in development when APP_URL is not set.

const ALLOWED_ORIGIN = process.env.APP_URL || '*';

function cors(req, res, next) {
  const origin = req.headers.origin;

  if (ALLOWED_ORIGIN === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin === ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // cache preflight for 24 h

  // Respond immediately to preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────
// Simple in-memory sliding-window limiter. Not shared across multiple Node
// processes, but sufficient for a single-container deployment.
//
// Usage:
//   router.post('/login', rateLimit({ max: 10, windowMs: 15 * 60 * 1000 }), handler)

const rateLimitStore = new Map(); // key -> { count, resetAt }

function rateLimit({ max, windowMs }) {
  return function rateLimitMiddleware(req, res, next) {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error: 'Too many requests — please try again later.',
      });
    }

    entry.count += 1;
    next();
  };
}

// Prune stale entries every 10 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 10 * 60 * 1000);

module.exports = { securityHeaders, cors, rateLimit };
