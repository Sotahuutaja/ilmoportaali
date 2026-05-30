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

module.exports = { canManageEvent };