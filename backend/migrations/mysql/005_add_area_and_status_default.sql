-- Add area/locality column and set default status to 'Active'
-- Add area column (idempotent via runner error handling)
ALTER TABLE projects ADD COLUMN area VARCHAR(255) DEFAULT NULL;

-- Ensure existing NULL status values are set to 'Active' before making column NOT NULL
UPDATE projects SET status = 'Active' WHERE status IS NULL;

ALTER TABLE projects MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Active';
