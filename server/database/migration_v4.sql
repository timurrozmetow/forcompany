-- ============================================================================
--  Company Drive — migration v4
--  Adds: work logs ("Что я сделал" — daily activity journal per user).
--  Apply:  mysql -u root -p company_drive < migration_v4.sql
--  (Fresh installs get this via schema.sql.)
-- ============================================================================
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS work_logs (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,   -- the employee the entry belongs to
  author_id  BIGINT UNSIGNED NULL,       -- who wrote it (self or an admin)
  entry_date DATE            NOT NULL,
  content    VARCHAR(2000)   NOT NULL,
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_wl_user_date (user_id, entry_date),
  KEY idx_wl_date (entry_date),
  CONSTRAINT fk_wl_user   FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_wl_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
