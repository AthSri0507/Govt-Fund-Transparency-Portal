-- Add profile fields to users table for citizen registration
ALTER TABLE users
  ADD COLUMN phone VARCHAR(50) NULL,
  ADD COLUMN city VARCHAR(100) NULL,
  ADD COLUMN state VARCHAR(100) NULL,
  ADD COLUMN id_type VARCHAR(50) NULL,
  ADD COLUMN id_number VARCHAR(255) NULL;
