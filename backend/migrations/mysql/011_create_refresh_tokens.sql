-- Create refresh_tokens table to persist refresh tokens (store hashes, not raw tokens)

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  INDEX idx_refresh_token_hash (token_hash),
  INDEX idx_refresh_user (user_id)
);
