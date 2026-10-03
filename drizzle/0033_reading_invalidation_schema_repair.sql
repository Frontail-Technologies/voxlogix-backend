-- Repair migration for deployments that received application code expecting
-- reading invalidation columns before the Drizzle journal knew about migration
-- 0032. Keep this idempotent so it is safe on fresh, fully migrated, and
-- partially repaired databases.

ALTER TABLE "measuring_point_readings"
  ADD COLUMN IF NOT EXISTS "status" varchar(40) DEFAULT 'VALID' NOT NULL,
  ADD COLUMN IF NOT EXISTS "invalidated_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "invalidated_by_user_id" uuid,
  ADD COLUMN IF NOT EXISTS "invalidation_reason" varchar(500);

ALTER TABLE "meter_counter_readings"
  ADD COLUMN IF NOT EXISTS "status" varchar(40) DEFAULT 'VALID' NOT NULL,
  ADD COLUMN IF NOT EXISTS "invalidated_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "invalidated_by_user_id" uuid,
  ADD COLUMN IF NOT EXISTS "invalidation_reason" varchar(500);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'measuring_point_readings_invalidated_by_user_id_admins_id_fk'
  ) THEN
    ALTER TABLE "measuring_point_readings"
      ADD CONSTRAINT "measuring_point_readings_invalidated_by_user_id_admins_id_fk"
      FOREIGN KEY ("invalidated_by_user_id") REFERENCES "admins"("id") ON DELETE set null;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'meter_counter_readings_invalidated_by_user_id_admins_id_fk'
  ) THEN
    ALTER TABLE "meter_counter_readings"
      ADD CONSTRAINT "meter_counter_readings_invalidated_by_user_id_admins_id_fk"
      FOREIGN KEY ("invalidated_by_user_id") REFERENCES "admins"("id") ON DELETE set null;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "measuring_point_readings_point_status_reported_at_idx"
  ON "measuring_point_readings" ("point_id", "status", "reported_at");

CREATE INDEX IF NOT EXISTS "meter_counter_readings_counter_status_reported_at_idx"
  ON "meter_counter_readings" ("counter_id", "status", "reported_at");
