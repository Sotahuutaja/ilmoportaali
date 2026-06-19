const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getLogs, clearLogs, CATEGORIES, LEVELS } = require('../services/logService');

const router = express.Router();

/**
 * GET /api/logs - Retrieve logs (admin only)
 * Query parameters:
 *   - category: Filter by log category
 *   - level: Filter by log level
 *   - search: Search in message and details
 *   - limit: Max number of logs to return (default 100, max 500)
 */
router.get('/', requireAuth, requireRole(undefined, 'admin'), (req, res) => {
  try {
    const { category, level, search, limit } = req.query;

    // Validate category
    if (category && !Object.values(CATEGORIES).includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Validate level
    if (level && !Object.values(LEVELS).includes(level)) {
      return res.status(400).json({ error: 'Invalid level' });
    }

    // Get logs with filters
    const logs = getLogs({
      category,
      level,
      search,
      limit: Math.min(parseInt(limit) || 100, 500)
    });

    res.json({
      logs,
      categories: CATEGORIES,
      levels: LEVELS,
      count: logs.length
    });
  } catch (err) {
    console.error('Failed to fetch logs:', err.message);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

/**
 * DELETE /api/logs - Clear all logs (admin only)
 */
router.delete('/', requireAuth, requireRole(undefined, 'admin'), (req, res) => {
  try {
    clearLogs();
    res.json({ message: 'Logs cleared' });
  } catch (err) {
    console.error('Failed to clear logs:', err.message);
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

module.exports = router;
