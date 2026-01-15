-- Add is_flagged column to projects for admin moderation
ALTER TABLE projects
  ADD COLUMN is_flagged TINYINT(1) NOT NULL DEFAULT 0;

-- Backfill: ensure existing rows have a default 0
UPDATE projects SET is_flagged = 0 WHERE is_flagged IS NULL;
