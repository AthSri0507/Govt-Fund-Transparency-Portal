-- Add contractor-related fields to projects
ALTER TABLE projects
  ADD COLUMN contractor_name VARCHAR(255) DEFAULT NULL,
  ADD COLUMN contractor_company VARCHAR(255) DEFAULT NULL,
  ADD COLUMN contractor_contact VARCHAR(255) DEFAULT NULL,
  ADD COLUMN contractor_registration_id VARCHAR(255) DEFAULT NULL,
  ADD COLUMN contract_start_date DATE DEFAULT NULL,
  ADD COLUMN contract_end_date DATE DEFAULT NULL;

-- No backfill provided; fields are optional and default to NULL
