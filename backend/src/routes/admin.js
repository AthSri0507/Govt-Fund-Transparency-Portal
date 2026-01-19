const express = require('express');
const db = require('../db_mysql');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /admin/users - list users (admin only)
router.get('/users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const rows = await db.query('SELECT id, name, email, role, is_active, created_at FROM users ORDER BY id DESC');
    return res.json({ data: rows });
  } catch (err) {
    console.error('admin/users list error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /admin/users/:id - update user role or active flag (admin only)
router.patch('/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id);
  const { role, active, is_active } = req.body || {};
  if (!id) return res.status(400).json({ message: 'Invalid user id' });
  try {
    const updates = [];
    const params = [];
    if (typeof role === 'string') { updates.push('role = ?'); params.push(role); }
    if (typeof active !== 'undefined') { updates.push('is_active = ?'); params.push(active ? 1 : 0); }
    if (typeof is_active !== 'undefined') { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (updates.length === 0) return res.status(400).json({ message: 'No valid fields to update' });
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    params.push(id);
    await db.query(sql, params);
    const rows = await db.query('SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?', [id]);
    return res.json({ data: rows[0] });
  } catch (err) {
    console.error('admin/users patch error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /admin/audit-logs - list audit entries with filters
router.get('/audit-logs', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { entity_type, entity_id, actor_id, from, to, project_id, include_related } = req.query;
    let { limit = 100, offset = 0 } = req.query;
    limit = Number(limit) || 100;
    offset = Math.max(0, Number(offset) || 0);
    // clamp limit to reasonable maximum
    limit = Math.min(1000, Math.max(1, limit));
    const where = [];
    const params = [];

    // Determine whether caller asked to include related activity for a project.
    const includeRelated = include_related === '1' || include_related === 'true' || include_related === 'yes';
    // Accept either explicit project_id param, or entity_type=project & entity_id when include_related is true
    const projectIdToMatch = project_id ? String(project_id) : (includeRelated && String(entity_type).toLowerCase() === 'project' && entity_id ? String(entity_id) : null);

    // If projectIdToMatch is set we will add a composite clause that matches direct project rows OR rows referencing the project inside details.
    // In that case we must NOT also add a simple `entity_type = ?` filter above, because that would prevent matching other entity types (e.g. fund_transaction).
    // So only add a simple entity_type filter when NOT matching related project activity.
    if (!projectIdToMatch && entity_type) { where.push('entity_type = ?'); params.push(entity_type); }
    if (!projectIdToMatch && entity_id) { where.push('entity_id = ?'); params.push(Number(entity_id)); }
    if (actor_id) { where.push('actor_id = ?'); params.push(Number(actor_id)); }
    if (from) { where.push('created_at >= ?'); params.push(from); }
    if (to) { where.push('created_at <= ?'); params.push(to); }
    if (projectIdToMatch) {
      // Match either direct project entity rows OR rows that reference the project_id inside details JSON
      // Use JSON_EXTRACT when possible, also check for alternate key 'project', and a regex fallback that matches
      // both numeric and quoted string forms, e.g. "project_id":42  or  "project_id":"42" or "project":42
      where.push(`((entity_type = 'project' AND entity_id = ?) OR (JSON_UNQUOTE(JSON_EXTRACT(details, '$.project_id')) = ?) OR (JSON_UNQUOTE(JSON_EXTRACT(details, '$.project')) = ?) OR (details REGEXP ?))`);
      params.push(Number(projectIdToMatch));
      params.push(String(projectIdToMatch));
      params.push(String(projectIdToMatch));
      // regexp to match "project_id" or "project" followed by : optional whitespace and optional quoted number/string
      const regex = `("project_id"|"project")\\s*:\\s*\"?${projectIdToMatch}\"?`;
      params.push(regex);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sql = `SELECT id, entity_type, entity_id, action, details, actor_id, created_at FROM audit_log ${whereSql} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const rows = await db.query(sql, params);
    return res.json({ data: rows });
  } catch (err) {
    console.error('admin/audit-logs error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /admin/funds - list fund transactions with optional joins and filters
router.get('/funds', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    let { project_id, official_id, from, to, min_amount, max_amount, project_name, amount, limit = 100, offset = 0 } = req.query;
    const where = ['1=1'];
    const params = [];
    if (project_id) { where.push('ft.project_id = ?'); params.push(Number(project_id)); }
    if (official_id) { where.push('ft.official_id = ?'); params.push(Number(official_id)); }
    if (from) { where.push('ft.transaction_date >= ?'); params.push(from); }
    if (to) { where.push('ft.transaction_date <= ?'); params.push(to); }
    if (min_amount) { where.push('ft.amount >= ?'); params.push(Number(min_amount)); }
    // Support frontend `amount` param as a minimum amount (legacy `min_amount` still supported)
    if (amount) {
      const n = Number(amount);
      if (!Number.isNaN(n)) { where.push('ft.amount >= ?'); params.push(n); }
    }
    // Allow filtering by project name (partial match)
    if (project_name) { where.push('p.name LIKE ?'); params.push(`%${String(project_name)}%`); }
    if (max_amount) { where.push('ft.amount <= ?'); params.push(Number(max_amount)); }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    limit = Number(limit) || 100;
    offset = Math.max(0, Number(offset) || 0);
    limit = Math.min(1000, Math.max(1, limit));
    const sql = `SELECT ft.id, ft.project_id, p.name as project_name, ft.official_id, u.name as official_name, ft.amount, ft.purpose, ft.transaction_date, ft.created_at
      FROM fund_transaction ft
      LEFT JOIN projects p ON p.id = ft.project_id
      LEFT JOIN users u ON u.id = ft.official_id
      ${whereSql}
      ORDER BY ft.transaction_date DESC
      LIMIT ${limit} OFFSET ${offset}`;
    // console.log('admin/funds SQL', sql, 'params', params);
    const rows = await db.query(sql, params);
    return res.json({ data: rows });
  } catch (err) {
    console.error('admin/funds error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /admin/project-status-stats - counts of projects by status (admin only)
router.get('/project-status-stats', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const rows = await db.query('SELECT status, COUNT(*) AS count FROM projects GROUP BY status');
    return res.json({ data: rows });
  } catch (err) {
    console.error('admin/project-status-stats error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /admin/projects/deleted - list soft-deleted projects (admin only)
router.get('/projects/deleted', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    let { limit = 100, offset = 0 } = req.query;
    limit = Math.min(1000, Math.max(1, Number(limit) || 100));
    offset = Math.max(0, Number(offset) || 0);
    const sql = `SELECT p.*, (SELECT COALESCE(SUM(amount),0) FROM fund_transaction WHERE project_id = p.id) AS budget_used FROM projects p WHERE COALESCE(p.is_deleted,0) = 1 ORDER BY p.id DESC LIMIT ${limit} OFFSET ${offset}`;
    const rows = await db.query(sql);
    return res.json({ data: rows });
  } catch (err) {
    console.error('admin/projects/deleted error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /admin/projects/flagged - list flagged projects (admin only)
router.get('/projects/flagged', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    let { limit = 100, offset = 0 } = req.query;
    limit = Math.min(1000, Math.max(1, Number(limit) || 100));
    offset = Math.max(0, Number(offset) || 0);
    const sql = `SELECT p.*, (SELECT COALESCE(SUM(amount),0) FROM fund_transaction WHERE project_id = p.id) AS budget_used FROM projects p WHERE COALESCE(p.is_flagged,0) = 1 ORDER BY p.id DESC LIMIT ${limit} OFFSET ${offset}`;
    const rows = await db.query(sql);
    return res.json({ data: rows });
  } catch (err) {
    console.error('admin/projects/flagged error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /admin/projects/:id/flag - set or clear the flagged state for a project (admin only)
router.patch('/projects/:id/flag', requireAuth, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid project id' });
  const { flagged } = req.body || {};
  if (typeof flagged === 'undefined') return res.status(400).json({ message: 'Missing flagged boolean in body' });
  try {
    await db.query('UPDATE projects SET is_flagged = ? WHERE id = ?', [flagged ? 1 : 0, id]);
    // insert audit log entry for moderation action
    const action = flagged ? 'flag' : 'unflag';
    const details = JSON.stringify({ flagged: !!flagged });
    await db.query('INSERT INTO audit_log (entity_type, entity_id, action, details, actor_id) VALUES (?,?,?,?,?)', ['project', id, action, details, req.user && req.user.id ? req.user.id : null]);
    const rows = await db.query('SELECT p.*, (SELECT COALESCE(SUM(amount),0) FROM fund_transaction WHERE project_id = p.id) AS budget_used FROM projects p WHERE p.id = ?', [id]);
    return res.json({ data: rows && rows[0] ? rows[0] : null });
  } catch (err) {
    console.error('admin/projects flag error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /admin/stats - small set of quick counts for admin dashboard
router.get('/stats', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const users = await db.query('SELECT COUNT(*) AS count FROM users');
    const funds = await db.query('SELECT COUNT(*) AS count FROM fund_transaction');
    const statuses = await db.query('SELECT status, COUNT(*) AS count FROM projects GROUP BY status');
    const disabled = await db.query('SELECT COUNT(*) AS count FROM users WHERE is_active = 0');
    const statusMap = Object.fromEntries((statuses || []).map(r => [r.status || 'Unknown', Number(r.count)]));
    return res.json({ data: {
      total_users: Number(users && users[0] && users[0].count) || 0,
      total_fund_transactions: Number(funds && funds[0] && funds[0].count) || 0,
      active_projects: statusMap['Active'] || 0,
      halted_projects: statusMap['Halted'] || 0,
      disabled_users: Number(disabled && disabled[0] && disabled[0].count) || 0
    } });
  } catch (err) {
    console.error('admin/stats error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
