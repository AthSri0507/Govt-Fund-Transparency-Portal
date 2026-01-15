-- Add unique constraint on users.email and CHECK constraints for budgets / fund amounts

ALTER TABLE users
  ADD UNIQUE INDEX uq_users_email (email);

ALTER TABLE projects
  ADD CONSTRAINT chk_projects_budget_total_positive CHECK (budget_total > 0);

ALTER TABLE fund_transaction
  ADD CONSTRAINT chk_fund_amount_positive CHECK (amount > 0);
