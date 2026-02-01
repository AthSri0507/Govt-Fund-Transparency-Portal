-- Migration: Add biometric authentication fields to users table
ALTER TABLE users ADD COLUMN biometric_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN face_embedding TEXT NULL;
