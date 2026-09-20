/**
 * Shared SQL predicate for the two public event-discovery routes (GET /events and
 * GET /events/:id) to decide whether a requester is allowed to see a
 * `restrict_visibility` event.
 *
 * An unrestricted event (the default) always passes. A restricted one only passes for:
 *   - the event's creator, a co-manager, or an admin (people who manage it)
 *   - an approved member of one of the event's eligible teams (event_teams)
 *   - anyone who already has a registration for it — so an existing registrant is never
 *     locked out of their own confirmation/payment flow just because the event was
 *     restricted after they signed up (e.g. Checkout.jsx still needs GET /events/:id to
 *     finish an additional-payment flow)
 *
 * This intentionally does NOT special-case "My registrations" (GET /registrations/my/list)
 * — that endpoint reads straight from the registrations/events tables on its own and never
 * goes through this predicate, so it keeps working for a restricted event regardless.
 *
 * Callers must alias the events table `e`, and pass the two next available positional
 * parameter placeholders (as strings, e.g. '$2', '$3') bound to req.user?.id ?? null and
 * req.user?.role ?? null, in that order. Comparisons against a null id/role naturally
 * evaluate false in Postgres, so an anonymous visitor is correctly excluded from every
 * restricted event without any special-casing here.
 *
 * @param {string} userIdParam - positional parameter placeholder for the requester's user id
 * @param {string} userRoleParam - positional parameter placeholder for the requester's role
 * @returns {string} a SQL boolean expression, safe to drop into a WHERE clause
 */
function visibilityClause(userIdParam, userRoleParam) {
  return `(
    NOT e.restrict_visibility
    OR e.creator_id = ${userIdParam}
    OR ${userRoleParam} = 'admin'
    OR EXISTS (SELECT 1 FROM event_managers em WHERE em.event_id = e.id AND em.user_id = ${userIdParam})
    OR EXISTS (
      SELECT 1 FROM event_teams et
      JOIN team_members tm ON tm.team_id = et.team_id AND tm.status = 'approved'
      WHERE et.event_id = e.id AND tm.user_id = ${userIdParam}
    )
    OR EXISTS (SELECT 1 FROM registrations reg WHERE reg.event_id = e.id AND reg.user_id = ${userIdParam})
  )`;
}

module.exports = { visibilityClause };
