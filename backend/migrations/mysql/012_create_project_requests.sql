-- Migration: Create project_requests table for collaborative workflow
CREATE TABLE IF NOT EXISTS project_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id BIGINT UNSIGNED NOT NULL,
  requested_by BIGINT UNSIGNED NOT NULL,
  requested_from BIGINT UNSIGNED NOT NULL,
  requested_fields JSON NOT NULL,
  status ENUM('PENDING','COMPLETED') DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_from) REFERENCES users(id) ON DELETE CASCADE
);
