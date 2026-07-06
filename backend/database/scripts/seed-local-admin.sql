-- Seed default local admin for Google Sign-In (email must match Google account).
--
-- Run from backend/:
--   npx wrangler d1 execute godashdevcore01 --local --env dev --file=./database/scripts/seed-local-admin.sql
--
-- password_hash is unused for Google login; required by schema only.

INSERT INTO users (email, password_hash, first_name, last_name, role, phone, is_active)
VALUES (
  'hbhandwaldar@gmail.com',
  'google_only',
  'Harshad',
  'Bhandwaldar',
  'admin',
  NULL,
  1
)
ON CONFLICT(email) DO UPDATE SET
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  role = excluded.role,
  is_active = 1,
  updated_at = datetime('now');
