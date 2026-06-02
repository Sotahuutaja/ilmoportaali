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
// Whitelist-based CORS: only allows requests from APP_URL (production) or
// localhost (development). Rejects all other origins.

function getAllowedOrigins() {
  const allowedOrigins = [];

  // Production origin
  if (process.env.APP_URL) {
    allowedOrigins.push(process.env.APP_URL);
  }

  // Development origins (only if explicitly enabled or no APP_URL)
  if (!process.env.APP_URL || process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:80');
    allowedOrigins.push('http://localhost:3000');
    allowedOrigins.push('http://127.0.0.1:80');
    allowedOrigins.push('http://127.0.0.1:3000');
  }

  return allowedOrigins;
}

const ALLOWED_ORIGINS = getAllowedOrigins();

// Validate configuration
if (process.env.NODE_ENV === 'production' && !process.env.APP_URL) {
  console.warn('WARNING: APP_URL not set in production. CORS will only allow localhost.');
}

function cors(req, res, next) {
  const origin = req.headers.origin;

  // Only set CORS header if origin is in whitelist
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
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
