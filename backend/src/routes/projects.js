const express = require('express');
const db = require('../db_mysql');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateBody, validateParams, Joi } = require('../middleware/validate');

const router = express.Router();

const projectCreateSchema = Joi.object({
  name: Joi.string().max(255).required(),
  department: Joi.string().max(100).allow('', null),
  region: Joi.string().max(100).allow('', null),
  state: Joi.string().max(100).allow('', null),
  city: Joi.string().max(100).allow('', null),
  latitude: Joi.number().precision(7).optional(),
  longitude: Joi.number().precision(7).optional(),
  budget_total: Joi.number().precision(2).min(0).required(),
  status: Joi.string().max(50).optional(),
  start_date: Joi.date().optional(),
  end_date: Joi.date().optional(),
  description: Joi.string().allow('', null)
});

const projectUpdateSchema = Joi.object({
  name: Joi.string().max(255).optional(),
  department: Joi.string().max(100).optional(),
  region: Joi.string().max(100).optional(),
  state: Joi.string().max(100).optional(),
  city: Joi.string().max(100).optional(),
  latitude: Joi.number().precision(7).optional(),
  longitude: Joi.number().precision(7).optional(),
  budget_total: Joi.number().precision(2).min(0).optional(),
  status: Joi.string().max(50).optional(),
  start_date: Joi.date().optional(),
  end_date: Joi.date().optional(),
  description: Joi.string().allow('', null)
});

const fundSchema = Joi.object({
  amount: Joi.number().precision(2).strict().required().min(0.01),
  purpose: Joi.string().max(255).required()
});

const commentSchema = Joi.object({
  text: Joi.string().required(),
  rating: Joi.number().integer().min(1).max(5).optional()
});

const updateSchema = Joi.object({
  update_text: Joi.string().required()
});

// GET /projects - list (simple)
router.get('/', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM projects ORDER BY id DESC LIMIT 100');
    return res.json({ data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /projects/:id
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const rows = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    const project = rows && rows[0];
    if (!project) return res.status(404).json({ message: 'Not found' });
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
    // defensive: normalize optional fields to SQL NULL (avoid undefined)
    const createdBy = (req.user && (req.user.id ?? req.user.user?.id ?? req.user.sub)) || null;
    console.log('Creating project - req.user =', req.user, 'createdBy =', createdBy);
    const result = await db.query(
      'INSERT INTO projects (name, department, region, state, city, latitude, longitude, budget_total, status, start_date, end_date, description, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        p.name,
        p.department ?? null,
        p.region ?? null,
        p.state ?? null,
        p.city ?? null,
        p.latitude ?? null,
        p.longitude ?? null,
        p.budget_total,
        p.status ?? null,
        p.start_date ?? null,
        p.end_date ?? null,
        p.description ?? null,
        createdBy
      ]
    );
    // mysql2 returns insertId only via connection.execute; our wrapper returns rows - fetch last insert id by selecting
    const rows = await db.query('SELECT * FROM projects WHERE id = LAST_INSERT_ID()');
    return res.status(201).json({ data: rows && rows[0] });
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

// PATCH /projects/:id - update
router.patch('/:id', requireAuth, requireRole('official', 'admin'), validateBody(projectUpdateSchema), async (req, res) => {
  const id = req.params.id;
  const fields = req.body;
  try {
    const sets = [];
    const params = [];
    for (const [k, v] of Object.entries(fields)) {
      sets.push(`${k} = ?`);
      params.push(v);
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
    const newUsed = (Number(project.budget_used) || 0) + Number(amount);
    const total = Number(project.budget_total) || 0;
    if (newUsed > total) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ message: 'Insufficient remaining budget' });
    }
    // insert fund_transaction
    const [insRes] = await conn.query('INSERT INTO fund_transaction (project_id, official_id, amount, purpose) VALUES (?,?,?,?)', [projectId, req.user.id, amount, purpose]);
    // update project budget_used
    await conn.query('UPDATE projects SET budget_used = ? WHERE id = ?', [newUsed, projectId]);
    // insert audit log
    const details = JSON.stringify({ amount, purpose, project_id: projectId });
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

