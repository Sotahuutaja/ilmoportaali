const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

// List all teams (public)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, u.name as created_by_name,
        COUNT(tm.id) FILTER (WHERE tm.status = 'approved')::integer as member_count
      FROM teams t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN team_members tm ON t.id = tm.team_id
      GROUP BY t.id, u.name
      ORDER BY t.name ASC
    `);
    res.json({ teams: result.rows });
  } catch (err) {
    console.error('Failed to fetch teams:', err.message);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get single team with members
router.get('/:id', async (req, res) => {
  try {
    const team = await pool.query('SELECT * FROM teams WHERE id = $1', [req.params.id]);
    if (!team.rows[0]) return res.status(404).json({ error: 'Team not found' });

    const members = await pool.query(`
      SELECT tm.*, u.first_name, u.last_name, u.email
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = $1
      ORDER BY tm.role DESC, u.last_name ASC, u.first_name ASC
    `, [req.params.id]);

    res.json({ team: team.rows[0], members: members.rows });
  } catch (err) {
    console.error('Failed to fetch team:', err.message);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// Create team (admin only)
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, description, captain_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Team name is required' });
  if (!captain_id) return res.status(400).json({ error: 'A captain must be assigned' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const team = await client.query(
      'INSERT INTO teams (name, description, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name, description, req.user.id]
    );

    await client.query(
      'INSERT INTO team_members (team_id, user_id, role, status) VALUES ($1, $2, $3, $4)',
      [team.rows[0].id, captain_id, 'captain', 'approved']
    );

    await client.query('COMMIT');
    res.status(201).json({ team: team.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Team name already taken' });
    console.error('Failed to create team:', err.message);
    res.status(500).json({ error: 'Failed to create team' });
  } finally {
    client.release();
  }
});

// Delete team (admin only)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM teams WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Team not found' });
    res.json({ message: 'Team deleted' });
  } catch (err) {
    console.error('Failed to delete team:', err.message);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// Update team auto-approve setting (admin or captain)
router.put('/:id/auto-approve', requireAuth, async (req, res) => {
  const { auto_approve_joins } = req.body;
  if (auto_approve_joins === undefined) return res.status(400).json({ error: 'auto_approve_joins is required' });

  try {
    // Check if user is admin or a captain of this team
    if (req.user.role !== 'admin') {
      const membership = await pool.query(
        'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND role = $3 AND status = $4',
        [req.params.id, req.user.id, 'captain', 'approved']
      );
      if (!membership.rows[0]) return res.status(403).json({ error: 'Only captains can change team settings' });
    }

    const result = await pool.query(
      'UPDATE teams SET auto_approve_joins = $1 WHERE id = $2 RETURNING *',
      [auto_approve_joins, req.params.id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Team not found' });
    res.json({ team: result.rows[0] });
  } catch (err) {
    console.error('Failed to update team:', err.message);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// Request to join a team
router.post('/:id/request', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get team auto_approve setting
    const teamResult = await client.query('SELECT auto_approve_joins FROM teams WHERE id = $1', [req.params.id]);
    if (!teamResult.rows[0]) return res.status(404).json({ error: 'Team not found' });

    const status = teamResult.rows[0].auto_approve_joins ? 'approved' : 'pending';

    await client.query(
      'INSERT INTO team_members (team_id, user_id, role, status) VALUES ($1, $2, $3, $4)',
      [req.params.id, req.user.id, 'member', status]
    );

    await client.query('COMMIT');
    const message = status === 'approved' ? 'Successfully joined team!' : 'Join request sent';
    res.status(201).json({ message });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Already a member or request pending' });
    console.error('Failed to request join:', err.message);
    res.status(500).json({ error: 'Failed to send join request' });
  } finally {
    client.release();
  }
});

// Invite a user to a team (captain or admin)
router.post('/:id/invite', requireAuth, async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  try {
    if (req.user.role !== 'admin') {
      const membership = await pool.query(
        'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND role = $3 AND status = $4',
        [req.params.id, req.user.id, 'captain', 'approved']
      );
      if (!membership.rows[0]) return res.status(403).json({ error: 'Only captains can invite members' });
    }

    await pool.query(
      'INSERT INTO team_members (team_id, user_id, role, status) VALUES ($1, $2, $3, $4)',
      [req.params.id, user_id, 'member', 'approved']
    );
    res.status(201).json({ message: 'User invited' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'User already a member' });
    console.error('Failed to invite user:', err.message);
    res.status(500).json({ error: 'Failed to invite user' });
  }
});

// Approve join request (captain or admin)
router.put('/:id/approve/:userId', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      const membership = await pool.query(
        'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND role = $3 AND status = $4',
        [req.params.id, req.user.id, 'captain', 'approved']
      );
      if (!membership.rows[0]) return res.status(403).json({ error: 'Only captains can approve requests' });
    }

    const result = await pool.query(
      'UPDATE team_members SET status = $1 WHERE team_id = $2 AND user_id = $3 RETURNING *',
      ['approved', req.params.id, req.params.userId]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Join request not found' });
    res.json({ message: 'Request approved', membership: result.rows[0] });
  } catch (err) {
    console.error('Failed to approve request:', err.message);
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

// Reject join request (captain or admin)
router.delete('/:id/reject/:userId', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      const membership = await pool.query(
        'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND role = $3 AND status = $4',
        [req.params.id, req.user.id, 'captain', 'approved']
      );
      if (!membership.rows[0]) return res.status(403).json({ error: 'Only captains can reject requests' });
    }

    const result = await pool.query(
      'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = $3 RETURNING id',
      [req.params.id, req.params.userId, 'pending']
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Join request not found' });
    res.json({ message: 'Request rejected' });
  } catch (err) {
    console.error('Failed to reject request:', err.message);
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// Remove a member (captain or admin)
router.delete('/:id/members/:userId', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      const membership = await pool.query(
        'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND role = $3 AND status = $4',
        [req.params.id, req.user.id, 'captain', 'approved']
      );
      if (!membership.rows[0]) return res.status(403).json({ error: 'Only captains can remove members' });
    }

    const result = await pool.query(
      'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.params.userId]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Member not found' });
    res.json({ message: 'Member removed' });
  } catch (err) {
    console.error('Failed to remove member:', err.message);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Get my team memberships
router.get('/my/memberships', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT tm.*, t.name, t.description, t.auto_approve_joins
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      WHERE tm.user_id = $1
      ORDER BY t.name ASC
    `, [req.user.id]);
    res.json({ teams: result.rows });
  } catch (err) {
    console.error('Failed to fetch memberships:', err.message);
    res.status(500).json({ error: 'Failed to fetch memberships' });
  }
});

// Transfer captain role to another member
router.put('/:id/captain', requireAuth, async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  const client = await pool.connect();
  try {
    // Verify caller is current captain or admin
    if (req.user.role !== 'admin') {
      const membership = await client.query(
        'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND role = $3 AND status = $4',
        [req.params.id, req.user.id, 'captain', 'approved']
      );
      if (!membership.rows[0]) return res.status(403).json({ error: 'Only the captain can transfer captaincy' });
    }

    // Verify target user is an approved member
    const target = await client.query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = $3',
      [req.params.id, user_id, 'approved']
    );
    if (!target.rows[0]) return res.status(400).json({ error: 'Target user is not an approved member' });

    await client.query('BEGIN');

    // Demote current captain to member
    await client.query(
      'UPDATE team_members SET role = $1 WHERE team_id = $2 AND role = $3',
      ['member', req.params.id, 'captain']
    );

    // Promote target to captain
    await client.query(
      'UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3',
      ['captain', req.params.id, user_id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Captaincy transferred' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to transfer captain:', err.message);
    res.status(500).json({ error: 'Failed to transfer captaincy' });
  } finally {
    client.release();
  }
});

// Update team name and description (admin only)
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, description, captain_id } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM teams WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Team not found' });

    const result = await client.query(
      `UPDATE teams SET
        name = COALESCE($1, name),
        description = COALESCE($2, description)
       WHERE id = $3 RETURNING *`,
      [name, description, req.params.id]
    );

    if (captain_id) {
      // Add as approved member if not already one
      await client.query(`
        INSERT INTO team_members (team_id, user_id, role, status)
        VALUES ($1, $2, 'captain', 'approved')
        ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'captain', status = 'approved'
      `, [req.params.id, captain_id]);
    }

    await client.query('COMMIT');
    res.json({ team: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Team name already taken' });
    console.error('Failed to update team:', err.message);
    res.status(500).json({ error: 'Failed to update team' });
  } finally {
    client.release();
  }
});

module.exports = router;
