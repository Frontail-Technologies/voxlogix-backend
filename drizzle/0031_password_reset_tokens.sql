-- Migration: 0031_password_reset_tokens
--
-- 1. Creates the password_reset_tokens table used by the new link-based
--    forgot-password flow (replaces the OTP-based flow; the old
--    password_reset_otps table is kept intact to preserve existing data).
--
-- 2. Backfills require_password_reset = false for established users.
--    Strategy: any admin who has a recorded last_login_at has already
--    authenticated successfully at least once, which means they have an
--    established password they know. These users should NOT be forced
--    through the first-login change flow.
--    Users with last_login_at IS NULL have never logged in — they may
--    genuinely be new accounts awaiting their first login and their
--    require_password_reset = true is left as-is so the enforcement
--    applies to them correctly once it is live.
--
-- NOTE: Before applying this migration to production, run the following
-- diagnostic query to understand the current state:
--
--   SELECT
--     COUNT(*) FILTER (WHERE require_password_reset = true AND last_login_at IS NOT NULL) AS will_be_backfilled,
--     COUNT(*) FILTER (WHERE require_password_reset = true AND last_login_at IS NULL)     AS stays_true_never_logged_in,
--     COUNT(*) FILTER (WHERE require_password_reset = false)                              AS already_false,
--     COUNT(*)                                                                            AS total_active
--   FROM admins
--   WHERE status = 'ACTIVE';

-- ----- 1. Create password_reset_tokens ----------------------------------------
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "admin_id"    uuid NOT NULL REFERENCES "admins"("id") ON DELETE CASCADE,
  "token_hash"  text NOT NULL,
  "expires_at"  timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "created_at"  timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "password_reset_tokens_admin_id_idx"
  ON "password_reset_tokens" ("admin_id");

-- ----- 2. Backfill established users ------------------------------------------
-- Established = has successfully logged in at least once (last_login_at IS NOT NULL).
-- The require_password_reset enforcement is only enforced after this migration
-- is applied; clearing it for established users prevents an unexpected lockout.
UPDATE admins
SET    require_password_reset = false,
       updated_at             = now()
WHERE  require_password_reset = true
  AND  last_login_at IS NOT NULL;
