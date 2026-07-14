/**
 * Log Service - Captures relevant logs for admin troubleshooting
 * Persists logs to PostgreSQL database
 */

const pool = require('../db');

// Log levels
const LEVELS = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  SUCCESS: 'success'
};

// Log categories for filtering
const CATEGORIES = {
  REGISTRATION: 'registration',
  PAYMENT: 'payment',
  REFUND: 'refund',
  CANCELLATION: 'cancellation',
  EMAIL: 'email',
  AUTH: 'auth',
  WEBHOOK: 'webhook',
  STRIPE: 'stripe',
  OTHER: 'other'
};

/**
 * Add a log entry to the database
 */
async function addLog(category, level, message, details = {}) {
  try {
    const result = await pool.query(
      `INSERT INTO admin_logs (timestamp, category, level, message, details)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, timestamp, category, level, message, details`,
      [new Date().toISOString(), category, level, message, JSON.stringify(details)]
    );
    return result.rows[0];
  } catch (err) {
    console.error('[LOG ERROR] Failed to write log to database:', err.message);
    // Don't throw - we don't want logging failures to break the app
    return null;
  }
}

/**
 * Get logs from database with optional filtering
 */
async function getLogs(options = {}) {
  try {
    let query = 'SELECT id, timestamp, category, level, message, details FROM admin_logs WHERE 1=1';
    const params = [];
    let paramCount = 1;

    // Filter by category
    if (options.category) {
      query += ` AND category = $${paramCount}`;
      params.push(options.category);
      paramCount++;
    }

    // Filter by level
    if (options.level) {
      query += ` AND level = $${paramCount}`;
      params.push(options.level);
      paramCount++;
    }

    // Filter by search term in message or details
    if (options.search) {
      query += ` AND (message ILIKE $${paramCount} OR details::text ILIKE $${paramCount})`;
      params.push(`%${options.search}%`);
      paramCount++;
    }

    // Order by timestamp descending (newest first)
    query += ' ORDER BY timestamp DESC';

    // Limit results
    const limit = Math.min(options.limit || 100, 500);
    query += ` LIMIT ${limit}`;

    const result = await pool.query(query, params);

    // Parse details JSON if it's a string
    const logs = result.rows.map(log => ({
      ...log,
      details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details
    }));

    // Enhance logs with human-readable names for IDs
    await enrichLogsWithNames(logs);

    return logs;
  } catch (err) {
    console.error('[LOG ERROR] Failed to fetch logs from database:', err.message);
    return [];
  }
}

/**
 * Enhance logs with human-readable names (users, events) instead of just IDs
 */
async function enrichLogsWithNames(logs) {
  try {
    // Collect all unique IDs from all logs
    const userIds = new Set();
    const eventIds = new Set();
    const registrationIds = new Set();

    logs.forEach(log => {
      const details = log.details || {};
      if (details.userId) userIds.add(details.userId);
      if (details.eventId) eventIds.add(details.eventId);
      if (details.registrationId) registrationIds.add(details.registrationId);
      // Also check in arrays
      if (Array.isArray(details.registrationIds)) details.registrationIds.forEach(id => registrationIds.add(id));
    });

    // Bulk fetch user names
    const userMap = {};
    if (userIds.size > 0) {
      const userResult = await pool.query(
        `SELECT id, first_name, last_name, email FROM users WHERE id = ANY($1)`,
        [Array.from(userIds)]
      );
      userResult.rows.forEach(user => {
        userMap[user.id] = `${user.first_name} ${user.last_name}` || user.email;
      });
    }

    // Bulk fetch event titles
    const eventMap = {};
    if (eventIds.size > 0) {
      const eventResult = await pool.query(
        `SELECT id, title FROM events WHERE id = ANY($1)`,
        [Array.from(eventIds)]
      );
      eventResult.rows.forEach(event => {
        eventMap[event.id] = event.title;
      });
    }

    // Bulk fetch registration info for user/event context
    const registrationMap = {};
    if (registrationIds.size > 0) {
      const regResult = await pool.query(
        `SELECT r.id, r.user_id, r.is_guest, r.guest_first_name, r.guest_last_name, r.event_id, e.title
         FROM registrations r
         LEFT JOIN events e ON r.event_id = e.id
         WHERE r.id = ANY($1)`,
        [Array.from(registrationIds)]
      );
      regResult.rows.forEach(reg => {
        const regName = reg.is_guest
          ? `${reg.guest_first_name} ${reg.guest_last_name}`
          : (userMap[reg.user_id] || 'Unknown user');
        registrationMap[reg.id] = { name: regName, eventTitle: reg.title };
      });
    }

    // Enhance each log with readable names
    logs.forEach(log => {
      const details = log.details || {};

      // Add readable user name
      if (details.userId && userMap[details.userId]) {
        details.userName = userMap[details.userId];
      }

      // Add readable event title
      if (details.eventId && eventMap[details.eventId]) {
        details.eventTitle = eventMap[details.eventId];
      }

      // Add readable registration info
      if (details.registrationId && registrationMap[details.registrationId]) {
        const reg = registrationMap[details.registrationId];
        details.registrationName = reg.name;
        if (reg.eventTitle) details.eventTitle = reg.eventTitle;
      }
    });
  } catch (err) {
    console.error('[LOG ERROR] Failed to enrich logs with names:', err.message);
    // Don't throw - we still want to return the logs even if enrichment fails
  }
}

/**
 * Clear all logs from database
 */
async function clearLogs() {
  try {
    await pool.query('DELETE FROM admin_logs');
  } catch (err) {
    console.error('[LOG ERROR] Failed to clear logs from database:', err.message);
  }
}

/**
 * Log helper functions for common scenarios
 * Calls are fire-and-forget to avoid blocking requests
 */
const logHelpers = {
  registrationError: (userId, eventId, error) => {
    addLog(CATEGORIES.REGISTRATION, LEVELS.ERROR,
      `Registration failed for user ${userId} on event ${eventId}`,
      { error: error.message || error, userId, eventId }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  registrationSuccess: (registrationIds, eventId) => {
    addLog(CATEGORIES.REGISTRATION, LEVELS.SUCCESS,
      `Successfully created ${registrationIds.length} registration(s) for event ${eventId}`,
      { registrationIds, eventId }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  paymentError: (paymentIntentId, error) => {
    addLog(CATEGORIES.PAYMENT, LEVELS.ERROR,
      `Payment failed for intent ${paymentIntentId}`,
      { error: error.message || error, paymentIntentId }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  paymentSuccess: (paymentIntentId, amount) => {
    addLog(CATEGORIES.PAYMENT, LEVELS.SUCCESS,
      `Payment confirmed: ${paymentIntentId} for €${(amount / 100).toFixed(2)}`,
      { paymentIntentId, amount }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  refundError: (registrationId, error) => {
    addLog(CATEGORIES.REFUND, LEVELS.ERROR,
      `Refund failed for registration ${registrationId}`,
      { error: error.message || error, registrationId }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  refundSuccess: (registrationId, amount, reason) => {
    addLog(CATEGORIES.REFUND, LEVELS.SUCCESS,
      `Refund issued for registration ${registrationId}: €${(amount / 100).toFixed(2)} (${reason})`,
      { registrationId, amount, reason }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  cancellationError: (registrationId, error) => {
    addLog(CATEGORIES.CANCELLATION, LEVELS.ERROR,
      `Registration cancellation failed for registration ${registrationId}`,
      { error: error.message || error, registrationId }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  cancellationSuccess: (registrationId, userId) => {
    addLog(CATEGORIES.CANCELLATION, LEVELS.SUCCESS,
      `Registration ${registrationId} cancelled by user ${userId}`,
      { registrationId, userId }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  emailError: (type, email, error) => {
    addLog(CATEGORIES.EMAIL, LEVELS.ERROR,
      `Failed to send ${type} email to ${email}`,
      { error: error.message || error, email, type }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  emailSuccess: (type, email) => {
    addLog(CATEGORIES.EMAIL, LEVELS.SUCCESS,
      `${type} email sent to ${email}`,
      { email, type }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  authError: (email, reason) => {
    addLog(CATEGORIES.AUTH, LEVELS.ERROR,
      `Auth failed for ${email}: ${reason}`,
      { email, reason }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  stripeError: (operation, error) => {
    addLog(CATEGORIES.STRIPE, LEVELS.ERROR,
      `Stripe ${operation} failed`,
      { error: error.message || error, operation }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  paymentStatusUpdated: (registrationId, oldStatus, newStatus, adminUserId, notes) => {
    addLog(CATEGORIES.PAYMENT, LEVELS.INFO,
      `Payment status updated for registration ${registrationId}: ${oldStatus} → ${newStatus}`,
      { registrationId, oldStatus, newStatus, adminUserId, notes }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  additionalPaymentConfirmed: (registrationId, amountCents) => {
    addLog(CATEGORIES.PAYMENT, LEVELS.SUCCESS,
      `Additional payment confirmed for registration ${registrationId}: €${(amountCents / 100).toFixed(2)}`,
      { registrationId, amount: amountCents }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  }
};

module.exports = {
  addLog,
  getLogs,
  clearLogs,
  logHelpers,
  LEVELS,
  CATEGORIES
};
