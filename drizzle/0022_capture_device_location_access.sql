ALTER TABLE "company_access_settings"
ADD COLUMN IF NOT EXISTS "capture_device_location_enabled" boolean DEFAULT false NOT NULL;
