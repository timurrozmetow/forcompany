-- ============================================================================
--  Company Drive — seed data
--  Creates the first admin account.
--
--     username: admin
--     password: admin12345     <-- CHANGE IT right after first login!
--
--  The password_hash below is bcrypt (cost 12) of "admin12345".
--  Prefer running `npm run seed` (server) which hashes at runtime; this file
--  exists so you can bootstrap with plain SQL too.
--
--  Run:  mysql -u root -p company_drive < seed.sql
-- ============================================================================

SET NAMES utf8mb4;

INSERT INTO users (username, password_hash, role, is_active)
SELECT 'admin', '$2a$12$0gg7p9fDopYw7C/2gJRmf.BnlAPRYkRYhFee65303tRXt3bxv5UW.', 'admin', 1
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');
