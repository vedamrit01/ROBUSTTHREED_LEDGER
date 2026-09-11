-- Run using npm run db:setup. It creates DB_NAME (default robustthreed_ledger).
-- Safe to run again. Never drops an existing database or table.
CREATE TABLE IF NOT EXISTS ledger_entries (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  kind ENUM('payment','expense') NOT NULL,
  title VARCHAR(140) NOT NULL,
  amount BIGINT UNSIGNED NOT NULL,
  channel ENUM('Amazon','Flipkart','Meesho','Direct','General') NOT NULL,
  category VARCHAR(60) NOT NULL,
  status ENUM('settled','pending') NOT NULL,
  date DATE NOT NULL,
  method ENUM('Bank transfer','UPI','Cash','Card','Other') NOT NULL,
  reference VARCHAR(100) NOT NULL DEFAULT '',
  notes VARCHAR(1000) NOT NULL DEFAULT '',
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at CHAR(24) CHARACTER SET ascii NOT NULL,
  updated_at CHAR(24) CHARACTER SET ascii NOT NULL,
  CONSTRAINT chk_ledger_amount CHECK (amount BETWEEN 1 AND 100000000000),
  INDEX idx_ledger_date (date, created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ledger_sessions (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  auth_version CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL,
  INDEX idx_session_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
