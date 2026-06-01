-- ============================================================================
--  Company Drive — migration v3
--  Adds: in-app notifications (the header "bell").
--  Apply:  mysql -u root -p company_drive < migration_v3.sql
--  (Fresh installs get this via schema.sql.)
-- ============================================================================
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,   -- recipient
  actor_id   BIGINT UNSIGNED NULL,       -- who triggered it
  type       VARCHAR(40)     NOT NULL,   -- comment_added | file_uploaded
  message    VARCHAR(512)    NOT NULL,
  file_id    BIGINT UNSIGNED NULL,
  folder_id  BIGINT UNSIGNED NULL,
  is_read    TINYINT(1)      NOT NULL DEFAULT 0,
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_user (user_id, is_read, created_at),
  CONSTRAINT fk_notif_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT fk_notif_actor  FOREIGN KEY (actor_id)  REFERENCES users(id)   ON DELETE SET NULL,
  CONSTRAINT fk_notif_file   FOREIGN KEY (file_id)   REFERENCES files(id)   ON DELETE CASCADE,
  CONSTRAINT fk_notif_folder FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
