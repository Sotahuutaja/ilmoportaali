// All times in the app are displayed and entered in Finnish time (Europe/Helsinki).

const TIMEZONE = 'Europe/Helsinki';

// ─── Display helpers ──────────────────────────────────────────────────────────

/**
 * Format a UTC timestamp as a Finnish date string, e.g. "15. kesäkuuta 2026".
 * Pass any Intl.DateTimeFormat options to override defaults.
 */
export function formatDate(utcString, options = {}) {
  if (!utcString) return '';
  return new Date(utcString).toLocaleDateString('fi-FI', {
    timeZone: TIMEZONE,
    ...options
  });
}

/**
 * Format a UTC timestamp as a Finnish date+time string, e.g. "15.6.2026 klo 10.00".
 * Pass any Intl.DateTimeFormat options to override defaults.
 */
export function formatDateTime(utcString, options = {}) {
  if (!utcString) return '';
  return new Date(utcString).toLocaleString('fi-FI', {
    timeZone: TIMEZONE,
    ...options
  });
}

// ─── Form input helpers ───────────────────────────────────────────────────────

/**
 * Convert a UTC ISO string to a "YYYY-MM-DDTHH:MM" string in Helsinki time,
 * suitable for use as the value of a <input type="datetime-local">.
 */
export function toHelsinki(utcString) {
  if (!utcString) return '';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(utcString)).replace(' ', 'T');
}

/**
 * Convert a "YYYY-MM-DDTHH:MM" string entered in Helsinki time (from a
 * datetime-local input) back to a UTC ISO string for sending to the API.
 */
export function helsinkiToUTC(localStr) {
  if (!localStr) return '';
  // Treat the input as UTC to get a reference Date, then measure the
  // Helsinki offset at that moment and subtract it.
  const ref = new Date(localStr + ':00Z');
  const helsinkiStr = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(ref).replace(' ', 'T');
  const offsetMs = new Date(helsinkiStr + ':00Z').getTime() - ref.getTime();
  return new Date(ref.getTime() - offsetMs).toISOString();
}
