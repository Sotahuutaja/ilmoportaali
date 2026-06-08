async function canManageEvent(userId, userRole, eventId, pool) {
  if (userRole === 'admin') {
    console.log(`[EVENT ACCESS] User ${userId} is admin - access granted`);
    return true;
  }
  const event = await pool.query('SELECT creator_id FROM events WHERE id = $1', [eventId]);
  if (!event.rows[0]) {
    console.log(`[EVENT ACCESS] Event ${eventId} not found`);
    return false;
  }
  if (event.rows[0].creator_id === userId) {
    console.log(`[EVENT ACCESS] User ${userId} is creator of event ${eventId}`);
    return true;
  }
  const manager = await pool.query(
    'SELECT id FROM event_managers WHERE event_id = $1 AND user_id = $2',
    [eventId, userId]
  );
  const isManager = manager.rows.length > 0;
  console.log(`[EVENT ACCESS] User ${userId} checked for co-manager of event ${eventId}: ${isManager}`);
  return isManager;
}

module.exports = { canManageEvent };