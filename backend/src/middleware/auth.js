const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
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