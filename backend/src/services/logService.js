/**
 * Log Service - Captures relevant logs for admin troubleshooting
 * Maintains an in-memory circular buffer of recent logs
 */

const MAX_LOGS = 500; // Keep last 500 logs in memory
const logs = [];

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
 * Add a log entry
 */
function addLog(category, level, message, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    category,
    level,
    message,
    details,
    id: Date.now() + Math.random() // Simple unique ID
  };

  logs.unshift(entry); // Add to front

  // Keep buffer size limited
  if (logs.length > MAX_LOGS) {
    logs.pop();
  }

  return entry;
}

/**
 * Get logs with optional filtering
 */
function getLogs(options = {}) {
  let filtered = [...logs];

  // Filter by category
  if (options.category) {
    filtered = filtered.filter(log => log.category === options.category);
  }

  // Filter by level
  if (options.level) {
    filtered = filtered.filter(log => log.level === options.level);
  }

  // Filter by search term in message
  if (options.search) {
    const searchLower = options.search.toLowerCase();
    filtered = filtered.filter(log =>
      log.message.toLowerCase().includes(searchLower) ||
      JSON.stringify(log.details).toLowerCase().includes(searchLower)
    );
  }

  // Limit results
  const limit = options.limit || 100;
  return filtered.slice(0, limit);
}

/**
 * Clear all logs
 */
function clearLogs() {
  logs.length = 0;
}

/**
 * Log helper functions for common scenarios
 */
const logHelpers = {
  registrationError: (userId, eventId, error) =>
    addLog(CATEGORIES.REGISTRATION, LEVELS.ERROR,
      `Registration failed for user ${userId} on event ${eventId}`,
      { error: error.message, userId, eventId }
    ),

  registrationSuccess: (registrationIds, eventId) =>
    addLog(CATEGORIES.REGISTRATION, LEVELS.SUCCESS,
      `Successfully created ${registrationIds.length} registration(s) for event ${eventId}`,
      { registrationIds, eventId }
    ),

  paymentError: (paymentIntentId, error) =>
    addLog(CATEGORIES.PAYMENT, LEVELS.ERROR,
      `Payment failed for intent ${paymentIntentId}`,
      { error: error.message, paymentIntentId }
    ),

  paymentSuccess: (paymentIntentId, amount) =>
    addLog(CATEGORIES.PAYMENT, LEVELS.SUCCESS,
      `Payment confirmed: ${paymentIntentId} for €${(amount / 100).toFixed(2)}`,
      { paymentIntentId, amount }
    ),

  refundError: (registrationId, error) =>
    addLog(CATEGORIES.REFUND, LEVELS.ERROR,
      `Refund failed for registration ${registrationId}`,
      { error: error.message, registrationId }
    ),

  refundSuccess: (registrationId, amount, reason) =>
    addLog(CATEGORIES.REFUND, LEVELS.SUCCESS,
      `Refund issued for registration ${registrationId}: €${(amount / 100).toFixed(2)} (${reason})`,
      { registrationId, amount, reason }
    ),

  cancellationError: (registrationId, error) =>
    addLog(CATEGORIES.CANCELLATION, LEVELS.ERROR,
      `Registration cancellation failed for registration ${registrationId}`,
      { error: error.message, registrationId }
    ),

  cancellationSuccess: (registrationId, userId) =>
    addLog(CATEGORIES.CANCELLATION, LEVELS.SUCCESS,
      `Registration ${registrationId} cancelled by user ${userId}`,
      { registrationId, userId }
    ),

  emailError: (type, email, error) =>
    addLog(CATEGORIES.EMAIL, LEVELS.ERROR,
      `Failed to send ${type} email to ${email}`,
      { error: error.message, email, type }
    ),

  emailSuccess: (type, email) =>
    addLog(CATEGORIES.EMAIL, LEVELS.SUCCESS,
      `${type} email sent to ${email}`,
      { email, type }
    ),

  authError: (email, reason) =>
    addLog(CATEGORIES.AUTH, LEVELS.ERROR,
      `Auth failed for ${email}: ${reason}`,
      { email, reason }
    ),

  stripeError: (operation, error) =>
    addLog(CATEGORIES.STRIPE, LEVELS.ERROR,
      `Stripe ${operation} failed`,
      { error: error.message, operation }
    )
};

module.exports = {
  addLog,
  getLogs,
  clearLogs,
  logHelpers,
  LEVELS,
  CATEGORIES
};
