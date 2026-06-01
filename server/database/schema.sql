-- ============================================================================
--  Company Drive — MySQL schema
--  Charset: utf8mb4 (full unicode incl. Turkish/Russian/emoji)
--  Run:  mysql -u root -p company_drive < schema.sql
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
--  users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username       VARCHAR(64)     NOT NULL,
  password_hash  VARCHAR(255)    NOT NULL,
  role           ENUM('admin','user') NOT NULL DEFAULT 'user',
  is_active      TINYINT(1)      NOT NULL DEFAULT 1,
  created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at  DATETIME        NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  folders  (self-referencing tree)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS folders (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(255)    NOT NULL,
  parent_id   BIGINT UNSIGNED NULL,
  created_by  BIGINT UNSIGNED NOT NULL,
  is_trashed  TINYINT(1)      NOT NULL DEFAULT 0,
  trashed_by  BIGINT UNSIGNED NULL,
  trashed_at  DATETIME        NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_folders_parent (parent_id),
  KEY idx_folders_trashed (is_trashed),
  KEY idx_folders_created_by (created_by),
  CONSTRAINT fk_folders_parent  FOREIGN KEY (parent_id)  REFERENCES folders(id) ON DELETE CASCADE,
  CONSTRAINT fk_folders_creator FOREIGN KEY (created_by) REFERENCES users(id)   ON DELETE RESTRICT,
  CONSTRAINT fk_folders_trasher FOREIGN KEY (trashed_by) REFERENCES users(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  files
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS files (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  folder_id     BIGINT UNSIGNED NULL,
  original_name VARCHAR(255)    NOT NULL,
  stored_name   VARCHAR(255)    NOT NULL,   -- UUID name on disk
  storage_path  VARCHAR(512)    NOT NULL,   -- relative path inside STORAGE_DIR
  mime_type     VARCHAR(191)    NOT NULL DEFAULT 'application/octet-stream',
  extension     VARCHAR(32)     NOT NULL DEFAULT '',
  size_bytes    BIGINT UNSIGNED NOT NULL DEFAULT 0,
  uploaded_by   BIGINT UNSIGNED NOT NULL,
  is_trashed    TINYINT(1)      NOT NULL DEFAULT 0,
  trashed_by    BIGINT UNSIGNED NULL,
  trashed_at    DATETIME        NULL,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_files_stored_name (stored_name),
  KEY idx_files_folder (folder_id),
  KEY idx_files_trashed (is_trashed),
  KEY idx_files_uploaded_by (uploaded_by),
  KEY idx_files_name (original_name),
  CONSTRAINT fk_files_folder   FOREIGN KEY (folder_id)   REFERENCES folders(id) ON DELETE CASCADE,
  CONSTRAINT fk_files_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id)   ON DELETE RESTRICT,
  CONSTRAINT fk_files_trasher  FOREIGN KEY (trashed_by)  REFERENCES users(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  activity_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NULL,
  action      VARCHAR(48)     NOT NULL,
  target_type ENUM('file','folder','user','auth','system') NOT NULL DEFAULT 'system',
  target_id   BIGINT UNSIGNED NULL,
  old_value   JSON            NULL,
  new_value   JSON            NULL,
  ip_address  VARCHAR(64)     NULL,
  user_agent  VARCHAR(512)    NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_logs_user (user_id),
  KEY idx_logs_action (action),
  KEY idx_logs_target (target_type, target_id),
  KEY idx_logs_created (created_at),
  CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
