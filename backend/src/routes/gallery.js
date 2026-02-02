/**
 * Project Gallery Routes
 * Handles image uploads and management for project galleries
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db_mysql');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateBody, validateParams, Joi } = require('../middleware/validate');

const router = express.Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../../uploads/gallery');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Allowed file types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Generate secure random filename to prevent path traversal
    const ext = path.extname(file.originalname).toLowerCase();
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, `${randomName}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only JPG and PNG images are allowed.'), false);
  }
  
  // Validate extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error('Invalid file extension. Only .jpg, .jpeg, and .png are allowed.'), false);
  }
  
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  }
});

// Validation schemas
const projectIdSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

const imageIdSchema = Joi.object({
  imageId: Joi.number().integer().positive().required()
});

const captionSchema = Joi.object({
  caption: Joi.string().trim().max(500).allow('', null).optional()
});

/**
 * POST /projects/:id/gallery
 * Upload an image to project gallery
 * Only citizens can upload
 */
router.post(
  '/projects/:id/gallery',
  requireAuth,
  requireRole('citizen'),
  validateParams(projectIdSchema),
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
        }
        return res.status(400).json({ message: err.message });
      } else if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req, res, next) => {
    const pool = db.getPool();
    const conn = await pool.getConnection();
    
    try {
      await conn.beginTransaction();
      
      const projectId = req.params.id;
      const userId = req.user.id || req.user.sub;
      const caption = req.body.caption || null;
      
      // Validate file was uploaded
      if (!req.file) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ message: 'No image file provided' });
      }
      
      // Verify project exists and is not deleted
      const [[project]] = await conn.execute(
        'SELECT id, name FROM projects WHERE id = ? AND COALESCE(is_deleted, 0) = 0',
        [projectId]
      );
      
      if (!project) {
        // Delete uploaded file
        fs.unlink(req.file.path, () => {});
        await conn.rollback();
        conn.release();
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Generate public URL (not exposing filesystem path)
      const imageUrl = `/uploads/gallery/${req.file.filename}`;
      
      // Insert gallery record
      const [result] = await conn.execute(
        `INSERT INTO project_gallery (project_id, uploaded_by, image_url, caption, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [projectId, userId, imageUrl, caption]
      );
      
      // Insert audit log
      await conn.execute(
        `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, details)
         VALUES (?, ?, ?, ?, ?)`,
        [
          userId,
          'GALLERY_IMAGE_UPLOADED',
          'project_gallery',
          result.insertId,
          JSON.stringify({
            project_id: projectId,
            project_name: project.name,
            image_url: imageUrl,
            caption: caption
          })
        ]
      );
      
      await conn.commit();
      conn.release();
      
      return res.status(201).json({
        message: 'Image uploaded successfully',
        image: {
          id: result.insertId,
          image_url: imageUrl,
          caption,
          created_at: new Date().toISOString()
        }
      });
    } catch (err) {
      await conn.rollback();
      conn.release();
      // Delete uploaded file on error
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      next(err);
    }
  }
);

/**
 * GET /projects/:id/gallery
 * Get all non-deleted images for a project
 * Accessible to all authenticated users
 */
router.get(
  '/projects/:id/gallery',
  requireAuth,
  validateParams(projectIdSchema),
  async (req, res, next) => {
    try {
      const projectId = req.params.id;
      
      // Verify project exists
      const projects = await db.query(
        'SELECT id, name FROM projects WHERE id = ? AND COALESCE(is_deleted, 0) = 0',
        [projectId]
      );
      
      if (!projects || projects.length === 0) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Get gallery images
      const images = await db.query(
        `SELECT 
          g.id,
          g.image_url,
          g.caption,
          g.created_at,
          g.uploaded_by,
          u.name AS uploaded_by_name
        FROM project_gallery g
        JOIN users u ON g.uploaded_by = u.id
        WHERE g.project_id = ? AND g.is_deleted = FALSE
        ORDER BY g.created_at DESC`,
        [projectId]
      );
      
      return res.json({
        project_id: projectId,
        project_name: projects[0].name,
        images: images || []
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /gallery/:imageId
 * Soft delete a gallery image
 * Admin can delete any image
 * Citizen can only delete their own images
 */
router.delete(
  '/gallery/:imageId',
  requireAuth,
  validateParams(imageIdSchema),
  async (req, res, next) => {
    const pool = db.getPool();
    const conn = await pool.getConnection();
    
    try {
      await conn.beginTransaction();
      
      const imageId = req.params.imageId;
      const userId = req.user.id || req.user.sub;
      const userRole = String(req.user.role).toLowerCase();
      
      // Get image details
      const [[image]] = await conn.execute(
        `SELECT g.*, p.name AS project_name 
         FROM project_gallery g
         JOIN projects p ON g.project_id = p.id
         WHERE g.id = ? AND g.is_deleted = FALSE`,
        [imageId]
      );
      
      if (!image) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ message: 'Image not found' });
      }
      
      // Check permission
      const isAdmin = userRole === 'admin';
      const isOwner = Number(image.uploaded_by) === Number(userId);
      
      if (!isAdmin && !isOwner) {
        await conn.rollback();
        conn.release();
        return res.status(403).json({ message: 'You do not have permission to delete this image' });
      }
      
      // Soft delete
      await conn.execute(
        'UPDATE project_gallery SET is_deleted = TRUE WHERE id = ?',
        [imageId]
      );
      
      // Insert audit log
      await conn.execute(
        `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, details)
         VALUES (?, ?, ?, ?, ?)`,
        [
          userId,
          'GALLERY_IMAGE_DELETED',
          'project_gallery',
          imageId,
          JSON.stringify({
            project_id: image.project_id,
            project_name: image.project_name,
            image_url: image.image_url,
            deleted_by_role: userRole
          })
        ]
      );
      
      await conn.commit();
      conn.release();
      
      return res.json({ message: 'Image deleted successfully' });
    } catch (err) {
      await conn.rollback();
      conn.release();
      next(err);
    }
  }
);

module.exports = router;
