const express = require('express');
const db = require('../db_mysql');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateBody, validateParams, Joi } = require('../middleware/validate');

const router = express.Router();

// Validation schemas
const createRequestSchema = Joi.object({
  project_id: Joi.number().integer().positive().required(),
  requested_from: Joi.number().integer().positive().required(),
  requested_fields: Joi.array().items(Joi.string().trim().min(1).max(100)).min(1).required()
});

const completeRequestSchema = Joi.object({
  field_values: Joi.object().pattern(
    Joi.string(),
    Joi.alternatives().try(
      Joi.string().allow('', null),
      Joi.number(),
      Joi.date()
    )
  ).required()
});

const requestIdParamSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

// Allowed project fields that can be requested
const ALLOWED_FIELDS = [
  'name', 'department', 'state', 'city', 'area', 'latitude', 'longitude',
  'budget_total', 'status', 'start_date', 'end_date', 'description',
  'contractor_name', 'contractor_company', 'contractor_contact',
  'contractor_registration_id', 'contract_start_date', 'contract_end_date'
];

/**
 * POST /project-requests
 * Create a new project request asking another official to complete fields
 * Only officials can create requests
 */
router.post(
  '/',
  requireAuth,
  requireRole('official'),
  validateBody(createRequestSchema),
  async (req, res, next) => {
    try {
      const { project_id, requested_from, requested_fields } = req.body;
      const requestedBy = req.user.id || req.user.sub;

      // Validate requested fields are allowed
      const invalidFields = requested_fields.filter(f => !ALLOWED_FIELDS.includes(f));
      if (invalidFields.length > 0) {
        return res.status(400).json({ 
          message: 'Invalid fields requested', 
          invalid_fields: invalidFields,
          allowed_fields: ALLOWED_FIELDS
        });
      }

      // Verify project exists
      const [project] = await db.query(
        'SELECT id, name FROM projects WHERE id = ? AND COALESCE(is_deleted, 0) = 0',
        [project_id]
      );
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      // Verify requested_from user exists and is an official
      const [targetUser] = await db.query(
        'SELECT id, name, role FROM users WHERE id = ?',
        [requested_from]
      );
      if (!targetUser) {
        return res.status(404).json({ message: 'Target user not found' });
      }
      if (String(targetUser.role).toLowerCase() !== 'official') {
        return res.status(400).json({ message: 'Requests can only be sent to officials' });
      }

      // Cannot request to self
      if (Number(requested_from) === Number(requestedBy)) {
        return res.status(400).json({ message: 'Cannot create request to yourself' });
      }

      // Check for existing pending request for same project and fields
      const existingRequests = await db.query(
        `SELECT id FROM project_requests 
         WHERE project_id = ? AND requested_from = ? AND status = 'PENDING'`,
        [project_id, requested_from]
      );
      if (existingRequests.length > 0) {
        return res.status(400).json({ 
          message: 'A pending request already exists for this official and project' 
        });
      }

      // Insert the request
      const result = await db.query(
        `INSERT INTO project_requests (project_id, requested_by, requested_from, requested_fields, status) 
         VALUES (?, ?, ?, ?, 'PENDING')`,
        [project_id, requestedBy, requested_from, JSON.stringify(requested_fields)]
      );

      // Log audit entry
      await db.query(
        `INSERT INTO audit_log (user_id, action, target_type, target_id, details) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          requestedBy,
          'PROJECT_REQUEST_CREATED',
          'project_request',
          result.insertId,
          JSON.stringify({
            project_id,
            project_name: project.name,
            requested_from,
            requested_from_name: targetUser.name,
            requested_fields
          })
        ]
      );

      return res.status(201).json({
        message: 'Request created successfully',
        request_id: result.insertId
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /project-requests/pending
 * Get all pending requests assigned to the logged-in official
 */
router.get(
  '/pending',
  requireAuth,
  requireRole('official'),
  async (req, res, next) => {
    try {
      const userId = req.user.id || req.user.sub;

      const requests = await db.query(
        `SELECT 
          pr.id,
          pr.project_id,
          pr.requested_by,
          pr.requested_fields,
          pr.status,
          pr.created_at,
          p.name AS project_name,
          p.department AS project_department,
          u.name AS requested_by_name,
          u.email AS requested_by_email
        FROM project_requests pr
        JOIN projects p ON pr.project_id = p.id
        JOIN users u ON pr.requested_by = u.id
        WHERE pr.requested_from = ? AND pr.status = 'PENDING'
        ORDER BY pr.created_at DESC`,
        [userId]
      );

      // Parse JSON fields
      const data = requests.map(r => ({
        ...r,
        requested_fields: typeof r.requested_fields === 'string' 
          ? JSON.parse(r.requested_fields) 
          : r.requested_fields
      }));

      return res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /project-requests/sent
 * Get all requests created by the logged-in official
 */
router.get(
  '/sent',
  requireAuth,
  requireRole('official'),
  async (req, res, next) => {
    try {
      const userId = req.user.id || req.user.sub;

      const requests = await db.query(
        `SELECT 
          pr.id,
          pr.project_id,
          pr.requested_from,
          pr.requested_fields,
          pr.status,
          pr.created_at,
          pr.completed_at,
          p.name AS project_name,
          p.department AS project_department,
          u.name AS requested_from_name,
          u.email AS requested_from_email
        FROM project_requests pr
        JOIN projects p ON pr.project_id = p.id
        JOIN users u ON pr.requested_from = u.id
        WHERE pr.requested_by = ?
        ORDER BY pr.created_at DESC`,
        [userId]
      );

      // Parse JSON fields
      const data = requests.map(r => ({
        ...r,
        requested_fields: typeof r.requested_fields === 'string' 
          ? JSON.parse(r.requested_fields) 
          : r.requested_fields
      }));

      return res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /project-requests/:id
 * Get a specific request (for officials involved or admin)
 */
router.get(
  '/:id',
  requireAuth,
  requireRole('official', 'admin'),
  validateParams(requestIdParamSchema),
  async (req, res, next) => {
    try {
      const requestId = req.params.id;
      const userId = req.user.id || req.user.sub;
      const userRole = String(req.user.role).toLowerCase();

      const [request] = await db.query(
        `SELECT 
          pr.*,
          p.name AS project_name,
          p.department AS project_department,
          p.state AS project_state,
          p.city AS project_city,
          ub.name AS requested_by_name,
          ub.email AS requested_by_email,
          uf.name AS requested_from_name,
          uf.email AS requested_from_email
        FROM project_requests pr
        JOIN projects p ON pr.project_id = p.id
        JOIN users ub ON pr.requested_by = ub.id
        JOIN users uf ON pr.requested_from = uf.id
        WHERE pr.id = ?`,
        [requestId]
      );

      if (!request) {
        return res.status(404).json({ message: 'Request not found' });
      }

      // Only allow access to involved officials or admin
      if (userRole !== 'admin' && 
          Number(request.requested_by) !== Number(userId) && 
          Number(request.requested_from) !== Number(userId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Parse JSON fields
      request.requested_fields = typeof request.requested_fields === 'string'
        ? JSON.parse(request.requested_fields)
        : request.requested_fields;

      return res.json({ data: request });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /project-requests/:id/complete
 * Complete a request by updating the specified project fields
 * Only the requested_from official can complete
 */
router.post(
  '/:id/complete',
  requireAuth,
  requireRole('official'),
  validateParams(requestIdParamSchema),
  validateBody(completeRequestSchema),
  async (req, res, next) => {
    const pool = db.getPool();
    const conn = await pool.getConnection();
    
    try {
      await conn.beginTransaction();

      const requestId = req.params.id;
      const userId = req.user.id || req.user.sub;
      const { field_values } = req.body;

      // Get the request
      const [[request]] = await conn.execute(
        `SELECT pr.*, p.name AS project_name 
         FROM project_requests pr
         JOIN projects p ON pr.project_id = p.id
         WHERE pr.id = ? FOR UPDATE`,
        [requestId]
      );

      if (!request) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ message: 'Request not found' });
      }

      // Verify the user is the requested_from
      if (Number(request.requested_from) !== Number(userId)) {
        await conn.rollback();
        conn.release();
        return res.status(403).json({ message: 'Only the assigned official can complete this request' });
      }

      // Check if already completed
      if (request.status === 'COMPLETED') {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ message: 'Request is already completed' });
      }

      // Parse requested fields
      const requestedFields = typeof request.requested_fields === 'string'
        ? JSON.parse(request.requested_fields)
        : request.requested_fields;

      // Verify all provided fields are in the requested fields
      const providedFields = Object.keys(field_values);
      const invalidFields = providedFields.filter(f => !requestedFields.includes(f));
      if (invalidFields.length > 0) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({
          message: 'Some provided fields were not requested',
          invalid_fields: invalidFields,
          requested_fields: requestedFields
        });
      }

      // Verify at least one field is being completed
      if (providedFields.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ message: 'At least one field must be provided' });
      }

      // Build dynamic UPDATE query for project - only update specified fields
      const updateParts = [];
      const updateValues = [];
      for (const field of providedFields) {
        if (ALLOWED_FIELDS.includes(field)) {
          updateParts.push(`${field} = ?`);
          updateValues.push(field_values[field]);
        }
      }

      if (updateParts.length > 0) {
        updateValues.push(request.project_id);
        await conn.execute(
          `UPDATE projects SET ${updateParts.join(', ')} WHERE id = ?`,
          updateValues
        );
      }

      // Mark request as completed
      await conn.execute(
        `UPDATE project_requests SET status = 'COMPLETED', completed_at = NOW() WHERE id = ?`,
        [requestId]
      );

      // Log audit entry
      await conn.execute(
        `INSERT INTO audit_log (user_id, action, target_type, target_id, details) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          userId,
          'PROJECT_REQUEST_COMPLETED',
          'project_request',
          requestId,
          JSON.stringify({
            project_id: request.project_id,
            project_name: request.project_name,
            completed_fields: providedFields,
            field_values: field_values
          })
        ]
      );

      await conn.commit();
      conn.release();

      return res.json({
        message: 'Request completed successfully',
        updated_fields: providedFields
      });
    } catch (err) {
      await conn.rollback();
      conn.release();
      next(err);
    }
  }
);

/**
 * GET /project-requests/officials/list
 * Get list of officials for request creation dropdown
 */
router.get(
  '/officials/list',
  requireAuth,
  requireRole('official'),
  async (req, res, next) => {
    try {
      const userId = req.user.id || req.user.sub;

      const officials = await db.query(
        `SELECT id, name, email FROM users WHERE role = 'Official' AND id != ?`,
        [userId]
      );

      return res.json({ data: officials });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /project-requests/all (Admin only)
 * View all requests across the system
 */
router.get(
  '/all',
  requireAuth,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const requests = await db.query(
        `SELECT 
          pr.*,
          p.name AS project_name,
          ub.name AS requested_by_name,
          uf.name AS requested_from_name
        FROM project_requests pr
        JOIN projects p ON pr.project_id = p.id
        JOIN users ub ON pr.requested_by = ub.id
        JOIN users uf ON pr.requested_from = uf.id
        ORDER BY pr.created_at DESC
        LIMIT 100`
      );

      const data = requests.map(r => ({
        ...r,
        requested_fields: typeof r.requested_fields === 'string'
          ? JSON.parse(r.requested_fields)
          : r.requested_fields
      }));

      return res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
