const express = require('express');
const db = require('../db_mysql');
const { requireAuth, requireRole, verify } = require('../middleware/auth');
const compliance = require('../services/complianceEngine');
const { validateBody, validateParams, Joi } = require('../middleware/validate');

const router = express.Router();

const projectCreateSchema = Joi.object({
  name: Joi.string().trim().min(3).max(255).pattern(/^[A-Za-z\s0-9\-\_\.\,]+$/).required(),
  department: Joi.string().trim().min(1).max(100).required(),
  state: Joi.string().trim().min(1).max(100).pattern(/^[A-Za-z\s]+$/).required(),
  city: Joi.string().trim().min(1).max(100).pattern(/^[A-Za-z\s]+$/).required(),
  area: Joi.string().trim().max(255).allow('', null).optional(),
  latitude: Joi.number().precision(7).min(-90).max(90).optional(),
  longitude: Joi.number().precision(7).min(-180).max(180).optional(),
  budget_total: Joi.number().precision(2).min(0.01).required(),
  status: Joi.string().trim().max(50).optional(),
  start_date: Joi.date().optional(),
  end_date: Joi.date().optional(),
  description: Joi.string().trim().allow('', null).optional(),
  contractor_name: Joi.string().trim().max(255).allow('', null).optional(),
  contractor_company: Joi.string().trim().max(255).allow('', null).optional(),
  contractor_contact: Joi.string().trim().max(255).allow('', null).optional(),
  contractor_registration_id: Joi.string().trim().max(255).allow('', null).optional(),
  contract_start_date: Joi.date().optional(),
  contract_end_date: Joi.date().optional()
});

const projectUpdateSchema = Joi.object({
  name: Joi.string().trim().min(3).max(255).pattern(/^[A-Za-z\s0-9\-\_\.\,]+$/).optional(),
  department: Joi.string().trim().min(1).max(100).optional(),
  state: Joi.string().trim().min(1).max(100).pattern(/^[A-Za-z\s]+$/).optional(),
  city: Joi.string().trim().min(1).max(100).pattern(/^[A-Za-z\s]+$/).optional(),
  area: Joi.string().trim().max(255).allow('', null).optional(),
  latitude: Joi.number().precision(7).min(-90).max(90).optional(),
  longitude: Joi.number().precision(7).min(-180).max(180).optional(),
  budget_total: Joi.number().precision(2).min(0.01).optional(),
  status: Joi.string().trim().max(50).optional(),
  start_date: Joi.date().optional(),
  end_date: Joi.date().optional(),
  description: Joi.string().trim().allow('', null).optional(),
  contractor_name: Joi.string().trim().max(255).allow('', null).optional(),
  contractor_company: Joi.string().trim().max(255).allow('', null).optional(),
  contractor_contact: Joi.string().trim().max(255).allow('', null).optional(),
  contractor_registration_id: Joi.string().trim().max(255).allow('', null).optional(),
  contract_start_date: Joi.date().optional(),
  contract_end_date: Joi.date().optional()
});

const fundSchema = Joi.object({
  amount: Joi.number().precision(2).strict().required().min(0.01),
  purpose: Joi.string().trim().min(1).max(255).required()
});

const commentSchema = Joi.object({
  text: Joi.string().trim().min(1).max(300).required(),
  rating: Joi.number().integer().min(1).max(5).optional()
});

const updateSchema = Joi.object({
  update_text: Joi.string().required()
});

// GET /projects - list (simple)
// GET /projects - list (aggregated for listing)
// Returns basic project info plus budget_used and avg_rating for citizen listing and filters
router.get('/', async (req, res) => {
  try {
    // If caller is an Official, restrict listing to projects they created.
    let filterClause = 'WHERE COALESCE(p.is_deleted,0) = 0';
    try {
      const auth = req.headers.authorization || '';
      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.slice(7);
        const payload = verify(token);
        if (payload && payload.role && String(payload.role).toLowerCase() === 'official') {
          const uid = payload.id || payload.sub || (payload.user && payload.user.id);
          // protect against missing uid
          if (uid) filterClause = 'WHERE COALESCE(p.is_deleted,0) = 0 AND p.created_by = ' + Number(uid);
        }
      }
    } catch (e) {
      // token invalid — treat as unauthenticated
    }

    const sql = `
      SELECT p.*,
        (SELECT COALESCE(SUM(amount),0) FROM fund_transaction WHERE project_id = p.id) AS budget_used,
        (SELECT AVG(rating) FROM comments WHERE project_id = p.id AND rating IS NOT NULL) AS avg_rating
      FROM projects p
      ${filterClause}
      ORDER BY p.id DESC
      LIMIT 100
    `;
    const rows = await db.query(sql);
    // normalize numeric types
    const data = (rows || []).map(r => ({
      ...r,
      budget_total: r.budget_total !== undefined && r.budget_total !== null ? Number(r.budget_total) : null,
      budget_used: r.budget_used ? Number(r.budget_used) : 0,
      avg_rating: r.avg_rating !== null ? Number(r.avg_rating) : null
    }));
    return res.json({ data });
  } catch (err) {
    console.error('projects list error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /projects/status-distribution - returns counts per status (for dashboards)
// Public endpoint so citizens, officials and admins can view project status distribution
router.get('/status-distribution', async (req, res) => {
  try {
    // If caller is an Official, return distribution for their projects only
    let where = '';
    try {
      const auth = req.headers.authorization || '';
      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.slice(7);
        const payload = verify(token);
        if (payload && payload.role && String(payload.role).toLowerCase() === 'official') {
          const uid = payload.id || payload.sub || (payload.user && payload.user.id);
          if (uid) where = ' WHERE created_by = ' + Number(uid);
        }
      }
    } catch (e) {}
    const rows = await db.query('SELECT status, COUNT(*) AS count FROM projects' + where + ' GROUP BY status');
    return res.json({ data: rows });
  } catch (err) {
    console.error('status-distribution error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /projects/:id
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    // Allow admins/officials to view soft-deleted projects when a valid token is provided.
    let allowDeleted = false;
    try {
      const auth = req.headers.authorization || '';
      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.slice(7);
        const payload = verify(token);
        if (payload && payload.role && ['admin', 'official'].includes(String(payload.role).toLowerCase())) {
          allowDeleted = true;
          req.user = payload;
        }
      }
    } catch (e) {
      // ignore token verification errors and treat request as unauthenticated
      allowDeleted = false;
    }

    // return project with computed budget_used (sum of fund transactions)
    const rows = await db.query(
      `SELECT p.*,
         (SELECT COALESCE(SUM(amount),0) FROM fund_transaction WHERE project_id = p.id) AS budget_used,
         (SELECT AVG(rating) FROM comments WHERE project_id = p.id AND rating IS NOT NULL) AS avg_rating
       FROM projects p
       WHERE p.id = ? ${allowDeleted ? '' : 'AND COALESCE(p.is_deleted,0) = 0'}`,
      [id]
    );
    const project = rows && rows[0];
    if (!project) return res.status(404).json({ message: 'Not found' });
    // If caller is an Official, allow viewing only their own projects
    if (req.user && req.user.role && String(req.user.role).toLowerCase() === 'official') {
      const creator = project.created_by || project.created_by_user_id || project.created_by_user || null;
      const uid = req.user.id || req.user.sub || (req.user.user && req.user.user.id);
      if (!creator || Number(creator) !== Number(uid)) return res.status(403).json({ message: 'Forbidden' });
    }
    // ensure numeric values are numbers
    if (project.budget_total !== undefined && project.budget_total !== null) project.budget_total = Number(project.budget_total);
    project.budget_used = project.budget_used ? Number(project.budget_used) : 0;
    project.avg_rating = project.avg_rating !== null && project.avg_rating !== undefined ? Number(project.avg_rating) : null;
    return res.json({ data: project });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /projects - create
router.post('/', requireAuth, requireRole('official', 'admin'), validateBody(projectCreateSchema), async (req, res) => {
  const p = req.body;
  try {
    // validate date ranges: start_date <= end_date and contract_start_date <= contract_end_date
    try {
      if (p.start_date && p.end_date) {
        const sd = new Date(p.start_date);
        const ed = new Date(p.end_date);
        if (isNaN(sd.getTime()) || isNaN(ed.getTime()) || sd > ed) return res.status(400).json({ message: 'Project start_date must be before or equal to end_date' });
      }
      if (p.contract_start_date && p.contract_end_date) {
        const cs = new Date(p.contract_start_date);
        const ce = new Date(p.contract_end_date);
        if (isNaN(cs.getTime()) || isNaN(ce.getTime()) || cs > ce) return res.status(400).json({ message: 'Contract start_date must be before or equal to contract end_date' });
      }
    } catch (e) {
      // fallthrough to main error handler
    }
    // defensive: normalize optional fields to SQL NULL (avoid undefined)
    const createdBy = (req.user && (req.user.id ?? req.user.user?.id ?? req.user.sub)) || null;
    console.log('Creating project - req.user =', req.user, 'createdBy =', createdBy);
    // Use pool.query to get insertId reliably
    const pool = db.getPool();
    const [insRes] = await pool.query(
      'INSERT INTO projects (name, department, state, city, area, latitude, longitude, budget_total, status, start_date, end_date, description, contractor_name, contractor_company, contractor_contact, contractor_registration_id, contract_start_date, contract_end_date, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        p.name,
        p.department,
        p.state,
        p.city,
        p.area ?? null,
        p.latitude ?? null,
        p.longitude ?? null,
        p.budget_total,
        p.status ?? 'Active',
        p.start_date ?? null,
        p.end_date ?? null,
        p.description ?? null,
        p.contractor_name ?? null,
        p.contractor_company ?? null,
        p.contractor_contact ?? null,
        p.contractor_registration_id ?? null,
        p.contract_start_date ?? null,
        p.contract_end_date ?? null,
        createdBy
      ]
    );
    const insertId = insRes && (insRes.insertId || (insRes[0] && insRes[0].insertId)) ? (insRes.insertId || insRes[0].insertId) : null;
    const rows = insertId ? await db.query('SELECT * FROM projects WHERE id = ?', [insertId]) : await db.query('SELECT * FROM projects WHERE id = LAST_INSERT_ID()');
    const created = rows && rows[0];
    try {
      const details = JSON.stringify({ project_id: created && created.id ? created.id : insertId, name: p.name, created_by: createdBy });
      await db.query('INSERT INTO audit_log (entity_type, entity_id, action, details, actor_id) VALUES (?,?,?,?,?)', ['project', created && created.id ? created.id : insertId, 'create', details, createdBy]);
    } catch (e) {
      console.error('Failed to write audit_log for project create', e);
    }
    return res.status(201).json({ data: created });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /projects/:id/updates - official posts a project update
router.post('/:id/updates', requireAuth, requireRole('official', 'admin'), validateBody(updateSchema), async (req, res) => {
  const projectId = req.params.id;
  const { update_text } = req.body;
  try {
    // officials may only post updates to projects they created
    if (req.user && req.user.role && String(req.user.role).toLowerCase() === 'official') {
      const pRows = await db.query('SELECT created_by FROM projects WHERE id = ?', [projectId]);
      const proj = pRows && pRows[0];
      const uid = req.user.id || req.user.sub || (req.user.user && req.user.user.id);
      if (!proj || Number(proj.created_by) !== Number(uid)) return res.status(403).json({ message: 'Forbidden' });
    }
    const result = await db.query('INSERT INTO project_update (project_id, official_id, update_text) VALUES (?,?,?)', [projectId, req.user.id, update_text]);
    const rows = await db.query('SELECT * FROM project_update WHERE id = LAST_INSERT_ID()');
    return res.status(201).json({ data: rows && rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /projects/:id/comments - create a comment and insert raw text into MongoDB.raw_feedback
// Requires authentication and `Citizen` role so comments are authored by citizens only
router.post('/:id/comments', requireAuth, requireRole('Citizen'), validateBody(commentSchema), async (req, res) => {
  const projectId = req.params.id;
  const { text, rating } = req.body;
  console.log('POST /projects/:id/comments - req.user =', req.user);
  const userId = (req.user && (req.user.id ?? req.user.user?.id ?? req.user.sub)) || null;
  try {
    const result = await db.query('INSERT INTO comments (project_id, user_id, text, rating) VALUES (?,?,?,?)', [projectId, userId, text, rating ?? null]);
    const rows = await db.query('SELECT * FROM comments WHERE id = LAST_INSERT_ID()');
    const comment = rows && rows[0];
    // insert raw feedback into MongoDB
    try {
      const { getMongo } = require('../db_mongo');
      const dbMongo = await getMongo();
      await dbMongo.collection('raw_feedback').insertOne({
        project_id: Number(projectId),
        comment_id: comment.id,
        user_id: userId,
        text,
        rating: rating ?? null,
        processed: false,
        created_at: new Date()
      });
    } catch (mErr) {
      console.error('Mongo insert failed:', mErr);
      // proceed — comment exists in MySQL even if Mongo write fails
    }
    return res.status(201).json({ data: comment });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /projects/:id/comments - list comments for a project
router.get('/:id/comments', async (req, res) => {
  const projectId = req.params.id;
  try {
    const rows = await db.query('SELECT * FROM comments WHERE project_id = ? ORDER BY id DESC', [projectId]);
    return res.json({ data: rows });
  } catch (err) {
    console.error('projects/comments list error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /projects/:id/timeline - merged feed of updates, fund transactions, and comments
router.get('/:id/timeline', async (req, res) => {
  const projectId = req.params.id;
  try {
    const funds = await db.query('SELECT id, "fund_transaction" AS type, amount, purpose, transaction_date AS occurred_at, official_id AS actor_id, created_at FROM fund_transaction WHERE project_id = ?', [projectId]);
    const updates = await db.query('SELECT id, "project_update" AS type, update_text AS text, update_date AS occurred_at, official_id AS actor_id, created_at FROM project_update WHERE project_id = ?', [projectId]);
    const comments = await db.query('SELECT id, "comment" AS type, text, created_at AS occurred_at, user_id AS actor_id FROM comments WHERE project_id = ?', [projectId]);
    const merged = [...funds, ...updates, ...comments].map(r => ({ ...r, occurred_at: r.occurred_at || r.created_at }));
    merged.sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
    return res.json({ data: merged });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /projects/:id/sentiment-summary - returns aggregated sentiment for project
router.get('/:id/sentiment-summary', async (req, res) => {
  const projectId = req.params.id;
  try {
    const rows = await db.query('SELECT sentiment_summary_cached FROM comments WHERE project_id = ? AND sentiment_summary_cached IS NOT NULL', [projectId]);
    const scores = [];
    for (const r of rows) {
      let s = r.sentiment_summary_cached;
      if (!s) continue;
      if (typeof s === 'string') {
        try { s = JSON.parse(s); } catch (e) { continue; }
      }
      if (s && typeof s.score === 'number') scores.push(s.score);
    }
    if (scores.length === 0) return res.json({ data: { count: 0, average: null, min: null, max: null, summary_text: 'No processed comments yet.' } });
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const max = Math.max(...scores);

    // Also compute simple label counts and top tokens for a human-friendly summary
    const counts = { positive: 0, neutral: 0, negative: 0 };
    const tokenFreq = Object.create(null);
    for (const r of rows) {
      let s = r.sentiment_summary_cached;
      if (!s) continue;
      if (typeof s === 'string') {
        try { s = JSON.parse(s); } catch (e) { continue; }
      }
      if (!s || typeof s.score !== 'number') continue;
      const sc = s.score;
      if (sc > 0) counts.positive++;
      else if (sc < 0) counts.negative++;
      else counts.neutral++;
      if (Array.isArray(s.tokens)) {
        for (const t of s.tokens) {
          if (!t || typeof t !== 'string') continue;
          const tok = t.toLowerCase();
          tokenFreq[tok] = (tokenFreq[tok] || 0) + 1;
        }
      }
    }

    // derive top tokens (simple, exclude very short tokens)
    const topTokens = Object.entries(tokenFreq)
      .filter(([t]) => t.length > 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);

    // Build a concise human-friendly sentence
    const total = counts.positive + counts.neutral + counts.negative;
    let predominant = 'neutral';
    if (counts.positive > counts.neutral && counts.positive >= counts.negative) predominant = 'positive';
    if (counts.negative > counts.neutral && counts.negative > counts.positive) predominant = 'negative';
    const pct = (counts[predominant] / total * 100).toFixed(0);
    const avgRounded = Math.round(avg * 100) / 100;
    let summary_text = `${pct}% ${predominant} comments (avg score ${avgRounded}).`;
    if (topTokens.length) summary_text += ` Common words: ${topTokens.slice(0,3).join(', ')}.`;

    return res.json({ data: { count: scores.length, average: avg, min, max, counts, topTokens, summary_text } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /projects/:id/budget-timeseries - returns daily sums and cumulative used amounts
// Public: allow citizens and unauthenticated viewers to see budget timeline for transparency
router.get('/:id/budget-timeseries', async (req, res) => {
  const projectId = req.params.id;
  try {
    const rows = await db.query(
      `SELECT DATE(created_at) AS date, COALESCE(SUM(amount),0) AS amount
       FROM fund_transaction
       WHERE project_id = ?
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) ASC`,
      [projectId]
    );
    let cum = 0;
    const data = (rows || []).map(r => {
      const amt = Number(r.amount || 0);
      cum += amt;
      return { date: r.date, amount: amt, cumulative: cum };
    });
    return res.json({ data });
  } catch (err) {
    console.error('budget-timeseries error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});
// PATCH /projects/:id - update
router.patch('/:id', requireAuth, requireRole('official', 'admin'), validateBody(projectUpdateSchema), async (req, res) => {
  const id = req.params.id;
  const fields = req.body;
  try {
    // validate date ranges if provided; if only one side provided, fetch existing value to compare
    try {
      // helper to parse date-like values
      const parseDate = v => (v ? new Date(v) : null);
      // fetch existing project if necessary
      let existing = null;
      if ((fields.start_date && !fields.end_date) || (!fields.start_date && fields.end_date) || (fields.contract_start_date && !fields.contract_end_date) || (!fields.contract_start_date && fields.contract_end_date)) {
        const er = await db.query('SELECT start_date, end_date, contract_start_date, contract_end_date FROM projects WHERE id = ?', [id]);
        existing = er && er[0] ? er[0] : null;
      }
      if (fields.start_date || fields.end_date) {
        const sd = parseDate(fields.start_date || (existing && existing.start_date));
        const ed = parseDate(fields.end_date || (existing && existing.end_date));
        if (sd && ed && (isNaN(sd.getTime()) || isNaN(ed.getTime()) || sd > ed)) return res.status(400).json({ message: 'Project start_date must be before or equal to end_date' });
      }
      if (fields.contract_start_date || fields.contract_end_date) {
        const cs = parseDate(fields.contract_start_date || (existing && existing.contract_start_date));
        const ce = parseDate(fields.contract_end_date || (existing && existing.contract_end_date));
        if (cs && ce && (isNaN(cs.getTime()) || isNaN(ce.getTime()) || cs > ce)) return res.status(400).json({ message: 'Contract start_date must be before or equal to contract end_date' });
      }
    } catch (e) {
      // ignore and continue to main handler which will surface errors
    }
    // enforce ownership for officials
    if (req.user && req.user.role && String(req.user.role).toLowerCase() === 'official') {
      const pRows = await db.query('SELECT created_by FROM projects WHERE id = ?', [id]);
      const proj = pRows && pRows[0];
      const uid = req.user.id || req.user.sub || (req.user.user && req.user.user.id);
      if (!proj || Number(proj.created_by) !== Number(uid)) return res.status(403).json({ message: 'Forbidden' });
    }
    const sets = [];
    const params = [];
    for (const [k, v] of Object.entries(fields)) {
      sets.push(`${k} = ?`);
      // normalize empty strings to NULL for optional fields
      params.push(v === '' ? null : v);
    }
    if (sets.length === 0) return res.status(400).json({ message: 'No fields to update' });
    params.push(id);
    await db.query(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, params);
    const rows = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    return res.json({ data: rows && rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /projects/:id/disable - soft-delete a project (officials/admins)
router.post('/:id/disable', requireAuth, requireRole('official', 'admin'), async (req, res) => {
  const id = req.params.id;
  try {
    // officials may only disable their own projects
    if (req.user && req.user.role && String(req.user.role).toLowerCase() === 'official') {
      const pRows = await db.query('SELECT created_by FROM projects WHERE id = ?', [id]);
      const proj = pRows && pRows[0];
      const uid = req.user.id || req.user.sub || (req.user.user && req.user.user.id);
      if (!proj || Number(proj.created_by) !== Number(uid)) return res.status(403).json({ message: 'Forbidden' });
    }
    // run project-level policy
    const pRows = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    const projectRow = pRows && pRows[0];
    const pd = compliance.evaluate('project_action', { action: 'disable', project: projectRow });
    if (!pd || !pd.allowed) return res.status(400).json({ message: pd && pd.reason ? pd.reason : 'Action not allowed by policy' });

    await db.query('UPDATE projects SET is_deleted = 1, status = ? WHERE id = ?', ['Disabled', id]);
    await db.query('INSERT INTO audit_log (entity_type, entity_id, action, details, actor_id) VALUES (?,?,?,?,?)', ['project', id, 'disable', JSON.stringify({ reason: 'soft-delete by admin' }), req.user.id]);
    const rows = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    return res.json({ data: rows && rows[0] });
  } catch (err) {
    console.error('projects disable error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /projects/:id/restore - undo soft-delete (officials/admins)
router.post('/:id/restore', requireAuth, requireRole('official', 'admin'), async (req, res) => {
  const id = req.params.id;
  try {
    // officials may only restore their own projects
    if (req.user && req.user.role && String(req.user.role).toLowerCase() === 'official') {
      const pRows = await db.query('SELECT created_by FROM projects WHERE id = ?', [id]);
      const proj = pRows && pRows[0];
      const uid = req.user.id || req.user.sub || (req.user.user && req.user.user.id);
      if (!proj || Number(proj.created_by) !== Number(uid)) return res.status(403).json({ message: 'Forbidden' });
    }
    // project-level policy
    const pRows = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    const projectRow = pRows && pRows[0];
    const pd = compliance.evaluate('project_action', { action: 'restore', project: projectRow });
    if (!pd || !pd.allowed) return res.status(400).json({ message: pd && pd.reason ? pd.reason : 'Action not allowed by policy' });

    await db.query('UPDATE projects SET is_deleted = 0, status = ? WHERE id = ?', ['Active', id]);
    await db.query('INSERT INTO audit_log (entity_type, entity_id, action, details, actor_id) VALUES (?,?,?,?,?)', ['project', id, 'restore', JSON.stringify({ reason: 'restore by admin' }), req.user.id]);
    const rows = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    return res.json({ data: rows && rows[0] });
  } catch (err) {
    console.error('projects restore error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// PUT /projects/:id/status - change project status (officials/admins)
router.put('/:id/status', requireAuth, requireRole('official', 'admin'), async (req, res) => {
  const id = req.params.id;
  const { status } = req.body || {};
  const allowed = ['Active', 'Halted', 'Cancelled'];
  if (!status || !allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });
  try {
    // officials may only change status on their own projects
    if (req.user && req.user.role && String(req.user.role).toLowerCase() === 'official') {
      const pRows = await db.query('SELECT created_by FROM projects WHERE id = ?', [id]);
      const proj = pRows && pRows[0];
      const uid = req.user.id || req.user.sub || (req.user.user && req.user.user.id);
      if (!proj || Number(proj.created_by) !== Number(uid)) return res.status(403).json({ message: 'Forbidden' });
    }
    // project-level policy check for status change
    const pRowsAll = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    const projectRow = pRowsAll && pRowsAll[0];
    const pd = compliance.evaluate('project_action', { action: 'status_change', project: projectRow, newStatus: status });
    if (!pd || !pd.allowed) return res.status(400).json({ message: pd && pd.reason ? pd.reason : 'Action not allowed by policy' });

    await db.query('UPDATE projects SET status = ? WHERE id = ?', [status, id]);
    const rows = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    return res.json({ data: rows && rows[0] });
  } catch (err) {
    console.error('projects status update error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /projects/:id/funds - record fund transaction and update budgets atomically
router.post('/:id/funds', requireAuth, requireRole('official', 'admin'), validateBody(fundSchema), async (req, res) => {
  const projectId = req.params.id;
  const { amount, purpose } = req.body;
  const pool = db.getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // lock the project row
    const [projRows] = await conn.query('SELECT budget_total, budget_used FROM projects WHERE id = ? FOR UPDATE', [projectId]);
    const project = projRows && projRows[0];
    if (!project) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ message: 'Project not found' });
    }
    // compute recent frequency (transactions in last 30 days) to inform risk scoring
    const [freqRows] = await conn.query('SELECT COUNT(*) AS cnt FROM fund_transaction WHERE project_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)', [projectId]);
    const freq = (freqRows && freqRows[0] && Number(freqRows[0].cnt)) || 0;
    // run compliance checks before committing (include frequency for risk evaluation)
    const decision = compliance.evaluate('fund_transaction', { project, amount, frequency: freq });
    if (!decision || !decision.allowed) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ message: decision && decision.reason ? decision.reason : 'Transaction not allowed by policy' });
    }
    const newUsed = (Number(project.budget_used) || 0) + Number(amount);
    const total = Number(project.budget_total) || 0;
    // insert fund_transaction
    const [insRes] = await conn.query('INSERT INTO fund_transaction (project_id, official_id, amount, purpose) VALUES (?,?,?,?)', [projectId, req.user.id, amount, purpose]);
    // update project budget_used
    await conn.query('UPDATE projects SET budget_used = ? WHERE id = ?', [newUsed, projectId]);
    // insert audit log (include policy decision/risk if available)
    const detailsObj = { amount, purpose, project_id: projectId };
    if (decision && typeof decision.riskScore !== 'undefined') detailsObj.risk_score = decision.riskScore;
    if (decision && decision.risk_level) detailsObj.risk_level = decision.risk_level;
    if (decision && Array.isArray(decision.risk_reasons)) detailsObj.risk_reason = decision.risk_reasons.join(' + ');
    if (decision && decision.warning) detailsObj.warning = decision.warning;
    const details = JSON.stringify(detailsObj);
    await conn.query('INSERT INTO audit_log (entity_type, entity_id, action, details, actor_id) VALUES (?,?,?,?,?)', ['fund_transaction', insRes.insertId || null, 'create', details, req.user.id]);
    await conn.commit();
    conn.release();
    // return created transaction
    const [txRows] = await db.getPool().query('SELECT * FROM fund_transaction WHERE id = ?', [insRes.insertId]);
    return res.status(201).json({ data: txRows && txRows[0] });
  } catch (err) {
    console.error(err);
    try {
      await conn.rollback();
    } catch (e) {}
    conn.release();
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

