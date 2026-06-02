const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  // Read token from httpOnly cookie (secure, inaccessible to JavaScript)
  const token = req.cookies.accessToken;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    // Token expired or invalid - try to refresh
    if (err.name === 'TokenExpiredError') {
      return handleTokenRefresh(req, res, next);
    }
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Handle token refresh when access token expires
function handleTokenRefresh(req, res, next) {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    // Query database to get current user data (prevents privilege escalation)
    const pool = require('../db');
    pool.query('SELECT id, email, role FROM users WHERE id = $1', [decoded.id], (err, result) => {
      if (err || !result.rows[0]) {
        return res.status(401).json({ error: 'User not found' });
      }

      const user = result.rows[0];
      const newAccessToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      // Set new access token cookie
      res.cookie('accessToken', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000
      });

      req.user = { id: user.id, email: user.email, role: user.role };
      next();
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
}

/**
 * Verify user role against the database instead of trusting JWT claims.
 * This prevents privilege escalation if JWT_SECRET is compromised.
 * @param {Object} pool - Database connection pool
 * @param {...string} roles - Allowed roles
 * @returns {Function} Express middleware
 */
function requireRole(pool, ...roles) {
  return async (req, res, next) => {
    try {
      // Verify role claim exists
      if (!req.user.role) {
        return res.status(403).json({ error: 'Not authorised' });
      }

      // Check if claimed role is in allowed roles
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Not authorised' });
      }

      // Verify role against database (prevents privilege escalation)
      const result = await pool.query(
        'SELECT role FROM users WHERE id = $1',
        [req.user.id]
      );

      if (!result.rows[0]) {
        return res.status(401).json({ error: 'User not found' });
      }

      const actualRole = result.rows[0].role;

      // Verify actual database role matches JWT role and is in allowed roles
      if (actualRole !== req.user.role || !roles.includes(actualRole)) {
        console.warn(`Privilege escalation attempt: user ${req.user.id} claimed ${req.user.role} but database shows ${actualRole}`);
        return res.status(403).json({ error: 'Not authorised' });
      }

      next();
    } catch (err) {
      console.error('Role verification failed:', err.message);
      res.status(500).json({ error: 'Authorization check failed' });
    }
  };
}

module.exports = { requireAuth, requireRole };