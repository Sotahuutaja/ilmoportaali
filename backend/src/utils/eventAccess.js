async function canManageEvent(userId, userRole, eventId, pool) {
  if (userRole === 'admin') return true;
  const event = await pool.query('SELECT creator_id FROM events WHERE id = $1', [eventId]);
  if (!event.rows[0]) return false;
  if (event.rows[0].creator_id === userId) return true;
  const manager = await pool.query(
    'SELECT id FROM event_managers WHERE event_id = $1 AND user_id = $2',
    [eventId, userId]
  );
  return manager.rows.length > 0;
}

/**
 * Returns the set of team IDs allowed to register as a team for this event (the rows in
 * event_teams) — used to reject a registration submitted under a team_id that was never
 * made eligible for this event, rather than trusting whatever the client sends. An empty
 * set means no team can register under this event at all (individual registration may
 * still be allowed, depending on the event's own allow_individual_registration setting).
 *
 * @param {number|string} eventId
 * @param {import('pg').Pool|import('pg').PoolClient} pool
 * @returns {Promise<Set<number>>}
 */
async function getEligibleTeamIds(eventId, pool) {
  const result = await pool.query('SELECT team_id FROM event_teams WHERE event_id = $1', [eventId]);
  return new Set(result.rows.map(r => r.team_id));
}

module.exports = { canManageEvent, getEligibleTeamIds };