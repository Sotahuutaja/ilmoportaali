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
  EVENT: 'event',
  TEAM: 'team',
  USER: 'user',
  PRODUCT: 'product',
  WEBHOOK: 'webhook',
  STRIPE: 'stripe',
  VOLUNTEER: 'volunteer',
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

    // Limit + offset results (offset powers "load older" pagination in the admin UI)
    const limit = Math.min(parseInt(options.limit) || 100, 500);
    const offset = Math.max(parseInt(options.offset) || 0, 0);
    query += ` LIMIT ${limit} OFFSET ${offset}`;

    const result = await pool.query(query, params);

    // Parse details JSON if it's a string
    const logs = result.rows.map(log => ({
      ...log,
      details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details
    }));

    // Enhance logs with human-readable names for IDs — this is a fallback safety net: most
    // logHelpers below already resolve names at write time and bake them into both the
    // message and details, but this keeps older log rows (written before a name lookup was
    // added) and any log written without full context still readable.
    await enrichLogsWithNames(logs);

    return logs;
  } catch (err) {
    console.error('[LOG ERROR] Failed to fetch logs from database:', err.message);
    return [];
  }
}

/**
 * Enhance logs with human-readable names (users, events, teams, products) instead of just IDs
 */
async function enrichLogsWithNames(logs) {
  try {
    // Collect all unique IDs from all logs
    const userIds = new Set();
    const eventIds = new Set();
    const registrationIds = new Set();
    const teamIds = new Set();
    const productIds = new Set();

    logs.forEach(log => {
      const details = log.details || {};
      if (details.userId) userIds.add(details.userId);
      if (details.adminUserId) userIds.add(details.adminUserId);
      if (details.actorUserId) userIds.add(details.actorUserId);
      if (details.eventId) eventIds.add(details.eventId);
      if (details.registrationId) registrationIds.add(details.registrationId);
      if (details.teamId) teamIds.add(details.teamId);
      if (details.productId) productIds.add(details.productId);
      // Also check in arrays
      if (Array.isArray(details.registrationIds)) details.registrationIds.forEach(id => registrationIds.add(id));
    });

    // Bulk fetch user names (covers userId, adminUserId, actorUserId alike)
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

    // Bulk fetch team names
    const teamMap = {};
    if (teamIds.size > 0) {
      const teamResult = await pool.query(
        `SELECT id, name FROM teams WHERE id = ANY($1)`,
        [Array.from(teamIds)]
      );
      teamResult.rows.forEach(team => {
        teamMap[team.id] = team.name;
      });
    }

    // Bulk fetch product names (event_products — a deleted product still has a name, so no
    // deleted_at filter here; the log should still resolve the name of something that was
    // itself deleted or later restored)
    const productMap = {};
    if (productIds.size > 0) {
      const productResult = await pool.query(
        `SELECT id, name FROM event_products WHERE id = ANY($1)`,
        [Array.from(productIds)]
      );
      productResult.rows.forEach(product => {
        productMap[product.id] = product.name;
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

      // Add readable user name(s)
      if (details.userId && userMap[details.userId] && !details.userName) {
        details.userName = userMap[details.userId];
      }
      if (details.adminUserId && userMap[details.adminUserId] && !details.adminUserName) {
        details.adminUserName = userMap[details.adminUserId];
      }
      if (details.actorUserId && userMap[details.actorUserId] && !details.actorName) {
        details.actorName = userMap[details.actorUserId];
      }

      // Add readable event title
      if (details.eventId && eventMap[details.eventId] && !details.eventTitle) {
        details.eventTitle = eventMap[details.eventId];
      }

      // Add readable team name
      if (details.teamId && teamMap[details.teamId] && !details.teamName) {
        details.teamName = teamMap[details.teamId];
      }

      // Add readable product name
      if (details.productId && productMap[details.productId] && !details.productName) {
        details.productName = productMap[details.productId];
      }

      // Add readable registration info
      if (details.registrationId && registrationMap[details.registrationId]) {
        const reg = registrationMap[details.registrationId];
        if (!details.registrationName) details.registrationName = reg.name;
        if (reg.eventTitle && !details.eventTitle) details.eventTitle = reg.eventTitle;
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

// ---------------------------------------------------------------------------
// Name resolution helpers used by logHelpers below, so the message shown in the
// admin log list reads like "Jane Doe" / "Summer Camp 2026" instead of raw
// database IDs. Each one is defensive (never throws) so a lookup failure can
// never take down the action being logged; on failure it falls back to null,
// and the message falls back to "user #5" / "event #12" style text below.
// ---------------------------------------------------------------------------

async function resolveUserName(userId) {
  if (!userId) return null;
  try {
    const result = await pool.query('SELECT first_name, last_name, email FROM users WHERE id = $1', [userId]);
    const u = result.rows[0];
    if (!u) return null;
    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim();
    return name || u.email || null;
  } catch (err) {
    return null;
  }
}

async function resolveEventTitle(eventId) {
  if (!eventId) return null;
  try {
    const result = await pool.query('SELECT title FROM events WHERE id = $1', [eventId]);
    return result.rows[0]?.title || null;
  } catch (err) {
    return null;
  }
}

async function resolveTeamName(teamId) {
  if (!teamId) return null;
  try {
    const result = await pool.query('SELECT name FROM teams WHERE id = $1', [teamId]);
    return result.rows[0]?.name || null;
  } catch (err) {
    return null;
  }
}

async function resolveRegistrationInfo(registrationId) {
  if (!registrationId) return { name: null, eventTitle: null };
  try {
    const result = await pool.query(`
      SELECT r.is_guest, r.guest_first_name, r.guest_last_name, r.user_id, e.title,
             u.first_name, u.last_name, u.email
      FROM registrations r
      LEFT JOIN events e ON r.event_id = e.id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.id = $1
    `, [registrationId]);
    const row = result.rows[0];
    if (!row) return { name: null, eventTitle: null };
    const name = row.is_guest
      ? `${row.guest_first_name || ''} ${row.guest_last_name || ''}`.trim()
      : (`${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email);
    return { name: name || null, eventTitle: row.title || null };
  } catch (err) {
    return { name: null, eventTitle: null };
  }
}

// "Jane Doe" if we have it, otherwise "user #5" — used to build readable messages
// without ever leaving a bare, unlabelled number in the sentence.
const fallback = (name, label, id) => name || `${label} #${id}`;

/**
 * Log helper functions for common scenarios
 * Calls are fire-and-forget to avoid blocking requests. Most wrap their body in an async
 * IIFE so they can resolve human-readable names before writing the log, while still
 * returning immediately (undefined) to the caller like a synchronous fire-and-forget call.
 */
const logHelpers = {
  registrationError: (userId, eventId, error) => {
    (async () => {
      const [userName, eventTitle] = await Promise.all([resolveUserName(userId), resolveEventTitle(eventId)]);
      await addLog(CATEGORIES.REGISTRATION, LEVELS.ERROR,
        `Registration failed for ${fallback(userName, 'user', userId)} on ${fallback(eventTitle, 'event', eventId)}`,
        { error: error.message || error, userId, eventId, userName, eventTitle }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  // Used for both the paid-registration path (payments.js, after a payment is confirmed)
  // and free registrations (registrations.js), so it covers registration creation either way.
  registrationSuccess: (registrationIds, eventId) => {
    (async () => {
      const [eventTitle, infos] = await Promise.all([
        resolveEventTitle(eventId),
        Promise.all(registrationIds.map(id => resolveRegistrationInfo(id)))
      ]);
      const names = infos.map(i => i.name).filter(Boolean);
      const who = names.length > 0 ? names.join(', ') : `${registrationIds.length} registration(s)`;
      await addLog(CATEGORIES.REGISTRATION, LEVELS.SUCCESS,
        `Registered ${who} for ${fallback(eventTitle, 'event', eventId)}`,
        { registrationIds, eventId, eventTitle, registrationNames: names }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  registrationUpdated: (registrationId, eventId, adminUserId, productsChanged) => {
    (async () => {
      const [{ name, eventTitle }, adminName] = await Promise.all([
        resolveRegistrationInfo(registrationId),
        resolveUserName(adminUserId)
      ]);
      const what = productsChanged ? 'details and products' : 'details';
      await addLog(CATEGORIES.REGISTRATION, LEVELS.INFO,
        `${fallback(name, 'Registration', registrationId)}${eventTitle ? ` (${eventTitle})` : ''} ${what} updated by ${fallback(adminName, 'user', adminUserId)}`,
        { registrationId, eventId, adminUserId, productsChanged: !!productsChanged, registrationName: name, eventTitle, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
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

  paymentLinkResent: (registrationId, adminUserId, amountCents) => {
    (async () => {
      const [{ name, eventTitle }, adminName] = await Promise.all([
        resolveRegistrationInfo(registrationId),
        resolveUserName(adminUserId)
      ]);
      await addLog(CATEGORIES.PAYMENT, LEVELS.INFO,
        `Payment link resent for ${fallback(name, 'registration', registrationId)}${eventTitle ? ` (${eventTitle})` : ''}: €${(amountCents / 100).toFixed(2)} — by ${fallback(adminName, 'user', adminUserId)}`,
        { registrationId, eventTitle, amount: amountCents, adminUserId, registrationName: name, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  refundError: (registrationId, error) => {
    (async () => {
      const { name, eventTitle } = await resolveRegistrationInfo(registrationId);
      await addLog(CATEGORIES.REFUND, LEVELS.ERROR,
        `Refund failed for ${fallback(name, 'registration', registrationId)}${eventTitle ? ` (${eventTitle})` : ''}`,
        { error: error.message || error, registrationId, registrationName: name, eventTitle }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  refundSuccess: (registrationId, amount, reason) => {
    (async () => {
      const { name, eventTitle } = await resolveRegistrationInfo(registrationId);
      await addLog(CATEGORIES.REFUND, LEVELS.SUCCESS,
        `Refund issued for ${fallback(name, 'registration', registrationId)}${eventTitle ? ` (${eventTitle})` : ''}: €${(amount / 100).toFixed(2)} (${reason})`,
        { registrationId, amount, reason, registrationName: name, eventTitle }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  cancellationError: (registrationId, error) => {
    (async () => {
      const { name, eventTitle } = await resolveRegistrationInfo(registrationId);
      await addLog(CATEGORIES.CANCELLATION, LEVELS.ERROR,
        `Cancellation failed for ${fallback(name, 'registration', registrationId)}${eventTitle ? ` (${eventTitle})` : ''}`,
        { error: error.message || error, registrationId, registrationName: name, eventTitle }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  cancellationSuccess: (registrationId, userId) => {
    (async () => {
      const [{ name, eventTitle }, actorName] = await Promise.all([
        resolveRegistrationInfo(registrationId),
        resolveUserName(userId)
      ]);
      await addLog(CATEGORIES.CANCELLATION, LEVELS.SUCCESS,
        `${fallback(name, 'Registration', registrationId)}${eventTitle ? ` (${eventTitle})` : ''} cancelled by ${fallback(actorName, 'user', userId)}`,
        { registrationId, userId, registrationName: name, eventTitle, actorName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
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

  loginSuccess: (userId, email) => {
    addLog(CATEGORIES.AUTH, LEVELS.SUCCESS,
      `${email} logged in`,
      { userId, email }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  logoutSuccess: (userId, email) => {
    addLog(CATEGORIES.AUTH, LEVELS.INFO,
      `${email} logged out`,
      { userId, email }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  passwordResetRequested: (email) => {
    addLog(CATEGORIES.AUTH, LEVELS.INFO,
      `Password reset requested for ${email}`,
      { email }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  passwordResetCompleted: (email) => {
    addLog(CATEGORIES.AUTH, LEVELS.SUCCESS,
      `Password reset completed for ${email}`,
      { email }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  emailVerified: (email) => {
    addLog(CATEGORIES.AUTH, LEVELS.SUCCESS,
      `${email} verified their email address`,
      { email }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  emailChangeCompleted: (oldEmail, newEmail) => {
    addLog(CATEGORIES.AUTH, LEVELS.SUCCESS,
      `Email address changed from ${oldEmail} to ${newEmail}`,
      { oldEmail, newEmail }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  profileUpdated: (userId, email, fields) => {
    addLog(CATEGORIES.AUTH, LEVELS.INFO,
      `${email} updated their profile (${fields.join(', ')})`,
      { userId, email, fields }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  stripeError: (operation, error) => {
    addLog(CATEGORIES.STRIPE, LEVELS.ERROR,
      `Stripe ${operation} failed`,
      { error: error.message || error, operation }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  paymentStatusUpdated: (registrationId, oldStatus, newStatus, adminUserId, notes) => {
    (async () => {
      const [{ name, eventTitle }, adminName] = await Promise.all([
        resolveRegistrationInfo(registrationId),
        resolveUserName(adminUserId)
      ]);
      await addLog(CATEGORIES.PAYMENT, LEVELS.INFO,
        `Payment status for ${fallback(name, 'registration', registrationId)}${eventTitle ? ` (${eventTitle})` : ''} changed: ${oldStatus} → ${newStatus} — by ${fallback(adminName, 'user', adminUserId)}`,
        { registrationId, oldStatus, newStatus, adminUserId, notes, registrationName: name, eventTitle, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  additionalPaymentConfirmed: (registrationId, amountCents) => {
    (async () => {
      const { name, eventTitle } = await resolveRegistrationInfo(registrationId);
      await addLog(CATEGORIES.PAYMENT, LEVELS.SUCCESS,
        `Additional payment confirmed for ${fallback(name, 'registration', registrationId)}${eventTitle ? ` (${eventTitle})` : ''}: €${(amountCents / 100).toFixed(2)}`,
        { registrationId, amount: amountCents, registrationName: name, eventTitle }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  // --- Events ---------------------------------------------------------------

  eventCreated: (eventId, eventTitle, adminUserId) => {
    (async () => {
      const adminName = await resolveUserName(adminUserId);
      await addLog(CATEGORIES.EVENT, LEVELS.SUCCESS,
        `Event "${eventTitle}" created by ${fallback(adminName, 'user', adminUserId)}`,
        { eventId, eventTitle, adminUserId, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  eventUpdated: (eventId, eventTitle, adminUserId) => {
    (async () => {
      const adminName = await resolveUserName(adminUserId);
      await addLog(CATEGORIES.EVENT, LEVELS.INFO,
        `Event "${eventTitle}" updated by ${fallback(adminName, 'user', adminUserId)}`,
        { eventId, eventTitle, adminUserId, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  eventDeleted: (eventId, eventTitle, adminUserId) => {
    (async () => {
      const adminName = await resolveUserName(adminUserId);
      await addLog(CATEGORIES.EVENT, LEVELS.WARNING,
        `Event "${eventTitle}" deleted by ${fallback(adminName, 'user', adminUserId)}`,
        { eventId, eventTitle, adminUserId, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  eventManagerAdded: (eventId, eventTitle, targetUserId, adminUserId) => {
    (async () => {
      const [targetName, adminName] = await Promise.all([resolveUserName(targetUserId), resolveUserName(adminUserId)]);
      await addLog(CATEGORIES.EVENT, LEVELS.INFO,
        `${fallback(targetName, 'user', targetUserId)} added as manager of "${eventTitle}" by ${fallback(adminName, 'user', adminUserId)}`,
        { eventId, eventTitle, userId: targetUserId, adminUserId, userName: targetName, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  eventManagerRemoved: (eventId, eventTitle, targetUserId, adminUserId) => {
    (async () => {
      const [targetName, adminName] = await Promise.all([resolveUserName(targetUserId), resolveUserName(adminUserId)]);
      await addLog(CATEGORIES.EVENT, LEVELS.INFO,
        `${fallback(targetName, 'user', targetUserId)} removed as manager of "${eventTitle}" by ${fallback(adminName, 'user', adminUserId)}`,
        { eventId, eventTitle, userId: targetUserId, adminUserId, userName: targetName, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  // --- Teams ------------------------------------------------------------------
  // Team helpers accept an already-known teamName where the caller has it handy (most do,
  // since they already loaded the team row) and fall back to a lookup by teamId otherwise.

  teamCreated: (teamId, teamName, captainUserId, adminUserId) => {
    (async () => {
      const [name, captainName, adminName] = await Promise.all([
        teamName ? Promise.resolve(teamName) : resolveTeamName(teamId),
        resolveUserName(captainUserId),
        resolveUserName(adminUserId)
      ]);
      await addLog(CATEGORIES.TEAM, LEVELS.SUCCESS,
        `Team "${name || teamId}" created by ${fallback(adminName, 'user', adminUserId)} (captain: ${fallback(captainName, 'user', captainUserId)})`,
        { teamId, teamName: name, captainUserId, adminUserId, captainName, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  teamDeleted: (teamId, teamName, adminUserId) => {
    (async () => {
      const adminName = await resolveUserName(adminUserId);
      await addLog(CATEGORIES.TEAM, LEVELS.WARNING,
        `Team "${teamName || teamId}" deleted by ${fallback(adminName, 'user', adminUserId)}`,
        { teamId, teamName, adminUserId, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  teamUpdated: (teamId, teamName, actorUserId) => {
    (async () => {
      const [name, actorName] = await Promise.all([
        teamName ? Promise.resolve(teamName) : resolveTeamName(teamId),
        resolveUserName(actorUserId)
      ]);
      await addLog(CATEGORIES.TEAM, LEVELS.INFO,
        `Team "${name || teamId}" updated by ${fallback(actorName, 'user', actorUserId)}`,
        { teamId, teamName: name, actorUserId, actorName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  teamDescriptionUpdated: (teamId, teamName, actorUserId) => {
    (async () => {
      const [name, actorName] = await Promise.all([
        teamName ? Promise.resolve(teamName) : resolveTeamName(teamId),
        resolveUserName(actorUserId)
      ]);
      await addLog(CATEGORIES.TEAM, LEVELS.INFO,
        `Description updated for team "${name || teamId}" by ${fallback(actorName, 'user', actorUserId)}`,
        { teamId, teamName: name, actorUserId, actorName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  teamAutoApproveChanged: (teamId, teamName, autoApprove, actorUserId) => {
    (async () => {
      const [name, actorName] = await Promise.all([
        teamName ? Promise.resolve(teamName) : resolveTeamName(teamId),
        resolveUserName(actorUserId)
      ]);
      await addLog(CATEGORIES.TEAM, LEVELS.INFO,
        `Auto-approve ${autoApprove ? 'enabled' : 'disabled'} for team "${name || teamId}" by ${fallback(actorName, 'user', actorUserId)}`,
        { teamId, teamName: name, autoApprove, actorUserId, actorName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  teamJoinPasswordChanged: (teamId, teamName, enabled, actorUserId) => {
    (async () => {
      const [name, actorName] = await Promise.all([
        teamName ? Promise.resolve(teamName) : resolveTeamName(teamId),
        resolveUserName(actorUserId)
      ]);
      await addLog(CATEGORIES.TEAM, LEVELS.INFO,
        `Join password ${enabled ? 'set' : 'removed'} for team "${name || teamId}" by ${fallback(actorName, 'user', actorUserId)}`,
        { teamId, teamName: name, enabled, actorUserId, actorName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  teamJoinRequested: (teamId, teamName, userId, status) => {
    (async () => {
      const [name, userName] = await Promise.all([
        teamName ? Promise.resolve(teamName) : resolveTeamName(teamId),
        resolveUserName(userId)
      ]);
      const verb = status === 'approved' ? 'joined' : 'requested to join';
      await addLog(CATEGORIES.TEAM, LEVELS.SUCCESS,
        `${fallback(userName, 'user', userId)} ${verb} team "${name || teamId}"`,
        { teamId, teamName: name, userId, userName, status }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  teamJoinApproved: (teamId, teamName, userId, actorUserId) => {
    (async () => {
      const [name, userName, actorName] = await Promise.all([
        teamName ? Promise.resolve(teamName) : resolveTeamName(teamId),
        resolveUserName(userId),
        resolveUserName(actorUserId)
      ]);
      await addLog(CATEGORIES.TEAM, LEVELS.SUCCESS,
        `${fallback(userName, 'user', userId)}'s request to join "${name || teamId}" approved by ${fallback(actorName, 'user', actorUserId)}`,
        { teamId, teamName: name, userId, userName, actorUserId, actorName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  teamJoinRejected: (teamId, teamName, userId, actorUserId) => {
    (async () => {
      const [name, userName, actorName] = await Promise.all([
        teamName ? Promise.resolve(teamName) : resolveTeamName(teamId),
        resolveUserName(userId),
        resolveUserName(actorUserId)
      ]);
      await addLog(CATEGORIES.TEAM, LEVELS.WARNING,
        `${fallback(userName, 'user', userId)}'s request to join "${name || teamId}" rejected by ${fallback(actorName, 'user', actorUserId)}`,
        { teamId, teamName: name, userId, userName, actorUserId, actorName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  teamMemberInvited: (teamId, teamName, userId, actorUserId) => {
    (async () => {
      const [name, userName, actorName] = await Promise.all([
        teamName ? Promise.resolve(teamName) : resolveTeamName(teamId),
        resolveUserName(userId),
        resolveUserName(actorUserId)
      ]);
      await addLog(CATEGORIES.TEAM, LEVELS.SUCCESS,
        `${fallback(userName, 'user', userId)} invited to team "${name || teamId}" by ${fallback(actorName, 'user', actorUserId)}`,
        { teamId, teamName: name, userId, userName, actorUserId, actorName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  teamMemberRemoved: (teamId, teamName, userId, actorUserId, isSelf) => {
    (async () => {
      const [name, userName, actorName] = await Promise.all([
        teamName ? Promise.resolve(teamName) : resolveTeamName(teamId),
        resolveUserName(userId),
        resolveUserName(actorUserId)
      ]);
      const message = isSelf
        ? `${fallback(userName, 'user', userId)} left team "${name || teamId}"`
        : `${fallback(userName, 'user', userId)} removed from team "${name || teamId}" by ${fallback(actorName, 'user', actorUserId)}`;
      await addLog(CATEGORIES.TEAM, LEVELS.WARNING,
        message,
        { teamId, teamName: name, userId, userName, actorUserId, actorName, isSelf: !!isSelf }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  teamMemberUpdated: (teamId, teamName, userId, adminUserId, changes) => {
    (async () => {
      const [name, userName, adminName] = await Promise.all([
        teamName ? Promise.resolve(teamName) : resolveTeamName(teamId),
        resolveUserName(userId),
        resolveUserName(adminUserId)
      ]);
      await addLog(CATEGORIES.TEAM, LEVELS.INFO,
        `${fallback(userName, 'user', userId)}'s membership on "${name || teamId}" updated (${changes.join(', ')}) by ${fallback(adminName, 'user', adminUserId)}`,
        { teamId, teamName: name, userId, userName, adminUserId, adminUserName: adminName, changes }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  teamCaptainTransferred: (teamId, teamName, fromUserId, toUserId, actorUserId) => {
    (async () => {
      const [name, fromName, toName, actorName] = await Promise.all([
        teamName ? Promise.resolve(teamName) : resolveTeamName(teamId),
        resolveUserName(fromUserId),
        resolveUserName(toUserId),
        resolveUserName(actorUserId)
      ]);
      await addLog(CATEGORIES.TEAM, LEVELS.INFO,
        `Captaincy of "${name || teamId}" transferred from ${fallback(fromName, 'user', fromUserId)} to ${fallback(toName, 'user', toUserId)} by ${fallback(actorName, 'user', actorUserId)}`,
        { teamId, teamName: name, fromUserId, toUserId, actorUserId, fromName, toName, actorName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  // --- Users (admin actions on other users' accounts) --------------------------

  userUpdated: (userId, userName, adminUserId, fields) => {
    (async () => {
      const adminName = await resolveUserName(adminUserId);
      await addLog(CATEGORIES.USER, LEVELS.INFO,
        `${fallback(userName, 'User', userId)}'s account updated (${fields.join(', ')}) by ${fallback(adminName, 'user', adminUserId)}`,
        { userId, userName, adminUserId, adminUserName: adminName, fields }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  userPasswordReset: (userId, adminUserId) => {
    (async () => {
      const [userName, adminName] = await Promise.all([resolveUserName(userId), resolveUserName(adminUserId)]);
      await addLog(CATEGORIES.USER, LEVELS.WARNING,
        `Password reset for ${fallback(userName, 'user', userId)} by ${fallback(adminName, 'user', adminUserId)}`,
        { userId, userName, adminUserId, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  userDeleted: (userId, userName, adminUserId) => {
    (async () => {
      const adminName = await resolveUserName(adminUserId);
      await addLog(CATEGORIES.USER, LEVELS.WARNING,
        `${fallback(userName, 'User', userId)}'s account deleted by ${fallback(adminName, 'user', adminUserId)}`,
        { userId, userName, adminUserId, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  // --- Products -----------------------------------------------------------------

  productCreated: (productId, productName, eventId, adminUserId) => {
    (async () => {
      const [eventTitle, adminName] = await Promise.all([resolveEventTitle(eventId), resolveUserName(adminUserId)]);
      await addLog(CATEGORIES.PRODUCT, LEVELS.SUCCESS,
        `Product "${productName}" created for ${fallback(eventTitle, 'event', eventId)} by ${fallback(adminName, 'user', adminUserId)}`,
        { productId, productName, eventId, eventTitle, adminUserId, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  productUpdated: (productId, productName, eventId, adminUserId) => {
    (async () => {
      const [eventTitle, adminName] = await Promise.all([resolveEventTitle(eventId), resolveUserName(adminUserId)]);
      await addLog(CATEGORIES.PRODUCT, LEVELS.INFO,
        `Product "${productName}" updated (${fallback(eventTitle, 'event', eventId)}) by ${fallback(adminName, 'user', adminUserId)}`,
        { productId, productName, eventId, eventTitle, adminUserId, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  productReordered: (eventId, adminUserId, count) => {
    (async () => {
      const [eventTitle, adminName] = await Promise.all([resolveEventTitle(eventId), resolveUserName(adminUserId)]);
      await addLog(CATEGORIES.PRODUCT, LEVELS.INFO,
        `${count} product(s) reordered for ${fallback(eventTitle, 'event', eventId)} by ${fallback(adminName, 'user', adminUserId)}`,
        { eventId, eventTitle, adminUserId, adminUserName: adminName, count }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  productDeleted: (productId, productName, adminUserId) => {
    (async () => {
      const adminName = await resolveUserName(adminUserId);
      await addLog(CATEGORIES.PRODUCT, LEVELS.WARNING,
        `Product "${productName}" deleted (soft delete, preserves order history) by ${fallback(adminName, 'user', adminUserId)}`,
        { productId, productName, adminUserId, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  productRestored: (productId, productName, adminUserId) => {
    (async () => {
      const adminName = await resolveUserName(adminUserId);
      await addLog(CATEGORIES.PRODUCT, LEVELS.SUCCESS,
        `Product "${productName}" restored by ${fallback(adminName, 'user', adminUserId)}`,
        { productId, productName, adminUserId, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  // --- Webhooks (asynchronous events arriving from Stripe) -----------------------

  webhookPaymentSucceeded: (paymentIntentId, registrationId) => {
    (async () => {
      const { name, eventTitle } = await resolveRegistrationInfo(registrationId);
      await addLog(CATEGORIES.WEBHOOK, LEVELS.SUCCESS,
        `Stripe webhook: payment succeeded for ${fallback(name, 'registration', registrationId)}${eventTitle ? ` (${eventTitle})` : ''}`,
        { paymentIntentId, registrationId, registrationName: name, eventTitle }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  webhookPaymentFailed: (paymentIntentId, registrationId) => {
    (async () => {
      const { name, eventTitle } = await resolveRegistrationInfo(registrationId);
      await addLog(CATEGORIES.WEBHOOK, LEVELS.ERROR,
        `Stripe webhook: payment failed for ${fallback(name, 'registration', registrationId)}${eventTitle ? ` (${eventTitle})` : ''}`,
        { paymentIntentId, registrationId, registrationName: name, eventTitle }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  webhookPaymentCanceled: (paymentIntentId, registrationId) => {
    (async () => {
      const { name, eventTitle } = await resolveRegistrationInfo(registrationId);
      await addLog(CATEGORIES.WEBHOOK, LEVELS.WARNING,
        `Stripe webhook: payment canceled for ${fallback(name, 'registration', registrationId)}${eventTitle ? ` (${eventTitle})` : ''}`,
        { paymentIntentId, registrationId, registrationName: name, eventTitle }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  webhookError: (context, error) => {
    addLog(CATEGORIES.WEBHOOK, LEVELS.ERROR,
      `Stripe webhook error (${context}): ${error.message || error}`,
      { context, error: error.message || error }
    ).catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  // --- Volunteers -----------------------------------------------------------------

  volunteeringToggled: (eventId, eventTitle, enabled, adminUserId) => {
    (async () => {
      const adminName = await resolveUserName(adminUserId);
      await addLog(CATEGORIES.VOLUNTEER, LEVELS.INFO,
        `Volunteering ${enabled ? 'enabled' : 'disabled'} for "${eventTitle}" by ${fallback(adminName, 'user', adminUserId)}`,
        { eventId, eventTitle, enabled, adminUserId, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  volunteerRoleCreated: (roleId, roleName, eventId, adminUserId) => {
    (async () => {
      const [eventTitle, adminName] = await Promise.all([resolveEventTitle(eventId), resolveUserName(adminUserId)]);
      await addLog(CATEGORIES.VOLUNTEER, LEVELS.SUCCESS,
        `Volunteer role "${roleName}" created for ${fallback(eventTitle, 'event', eventId)} by ${fallback(adminName, 'user', adminUserId)}`,
        { roleId, roleName, eventId, eventTitle, adminUserId, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  volunteerRoleUpdated: (roleId, roleName, eventId, adminUserId) => {
    (async () => {
      const [eventTitle, adminName] = await Promise.all([resolveEventTitle(eventId), resolveUserName(adminUserId)]);
      await addLog(CATEGORIES.VOLUNTEER, LEVELS.INFO,
        `Volunteer role "${roleName}" updated (${fallback(eventTitle, 'event', eventId)}) by ${fallback(adminName, 'user', adminUserId)}`,
        { roleId, roleName, eventId, eventTitle, adminUserId, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  volunteerRoleDeleted: (roleId, roleName, eventId, adminUserId) => {
    (async () => {
      const [eventTitle, adminName] = await Promise.all([resolveEventTitle(eventId), resolveUserName(adminUserId)]);
      await addLog(CATEGORIES.VOLUNTEER, LEVELS.WARNING,
        `Volunteer role "${roleName}" deleted (${fallback(eventTitle, 'event', eventId)}) by ${fallback(adminName, 'user', adminUserId)}`,
        { roleId, roleName, eventId, eventTitle, adminUserId, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  volunteerDiscountSet: (roleId, roleName, productName, discountType, eventId, adminUserId) => {
    (async () => {
      const [eventTitle, adminName] = await Promise.all([resolveEventTitle(eventId), resolveUserName(adminUserId)]);
      await addLog(CATEGORIES.VOLUNTEER, LEVELS.INFO,
        `Discount rule (${discountType}) set for "${productName}" on role "${roleName}" (${fallback(eventTitle, 'event', eventId)}) by ${fallback(adminName, 'user', adminUserId)}`,
        { roleId, roleName, productName, discountType, eventId, eventTitle, adminUserId, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  volunteerApplicationSubmitted: (applicationId, roleName, eventId, userId) => {
    (async () => {
      const [eventTitle, userName] = await Promise.all([resolveEventTitle(eventId), resolveUserName(userId)]);
      await addLog(CATEGORIES.VOLUNTEER, LEVELS.INFO,
        `${fallback(userName, 'User', userId)} applied to volunteer as "${roleName}" for ${fallback(eventTitle, 'event', eventId)}`,
        { applicationId, roleName, eventId, eventTitle, userId, userName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  volunteerApplicationWithdrawn: (roleId, eventId, userId) => {
    (async () => {
      const [eventTitle, userName] = await Promise.all([resolveEventTitle(eventId), resolveUserName(userId)]);
      await addLog(CATEGORIES.VOLUNTEER, LEVELS.INFO,
        `${fallback(userName, 'User', userId)} withdrew their volunteer application for ${fallback(eventTitle, 'event', eventId)}`,
        { roleId, eventId, eventTitle, userId, userName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  volunteerApplicationApproved: (applicationId, roleName, eventId, userId, adminUserId) => {
    (async () => {
      const [eventTitle, userName, adminName] = await Promise.all([resolveEventTitle(eventId), resolveUserName(userId), resolveUserName(adminUserId)]);
      await addLog(CATEGORIES.VOLUNTEER, LEVELS.SUCCESS,
        `${fallback(userName, 'user', userId)}'s application for "${roleName}" (${fallback(eventTitle, 'event', eventId)}) approved by ${fallback(adminName, 'user', adminUserId)}`,
        { applicationId, roleName, eventId, eventTitle, userId, userName, adminUserId, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
  },

  volunteerApplicationRejected: (applicationId, roleName, eventId, userId, adminUserId) => {
    (async () => {
      const [eventTitle, userName, adminName] = await Promise.all([resolveEventTitle(eventId), resolveUserName(userId), resolveUserName(adminUserId)]);
      await addLog(CATEGORIES.VOLUNTEER, LEVELS.WARNING,
        `${fallback(userName, 'user', userId)}'s application for "${roleName}" (${fallback(eventTitle, 'event', eventId)}) rejected by ${fallback(adminName, 'user', adminUserId)}`,
        { applicationId, roleName, eventId, eventTitle, userId, userName, adminUserId, adminUserName: adminName }
      );
    })().catch(err => console.error('[LOG HELPER ERROR]', err.message));
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
