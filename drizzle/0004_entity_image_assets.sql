ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "logo_url" text;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "logo_key" text;
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "avatar_url" text;
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "avatar_key" text;
ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "media_url" text;
ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "media_key" text;
