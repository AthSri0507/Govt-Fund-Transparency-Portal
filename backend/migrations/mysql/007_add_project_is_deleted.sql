-- Add soft-delete flag to projects
ALTER TABLE projects
  ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0 AFTER status;

-- Ensure existing rows are not deleted
UPDATE projects SET is_deleted = 0 WHERE is_deleted IS NULL;
