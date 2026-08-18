ALTER TABLE "module_fields" ADD COLUMN IF NOT EXISTS "source_type" varchar(40) DEFAULT 'ai' NOT NULL;
ALTER TABLE "module_fields" ADD COLUMN IF NOT EXISTS "source_key" varchar(120);
ALTER TABLE "module_fields" ADD COLUMN IF NOT EXISTS "feed_visible" boolean DEFAULT true NOT NULL;
ALTER TABLE "module_fields" ADD COLUMN IF NOT EXISTS "report_visible" boolean DEFAULT true NOT NULL;
ALTER TABLE "module_fields" ADD COLUMN IF NOT EXISTS "validation_rules" jsonb DEFAULT NULL;

ALTER TABLE "company_access_settings"
ADD COLUMN IF NOT EXISTS "capture_device_location_enabled" boolean DEFAULT false NOT NULL;

ALTER TABLE "admins"
ADD COLUMN IF NOT EXISTS "employee_id" varchar(80);

CREATE INDEX IF NOT EXISTS "admins_company_employee_id_idx"
ON "admins" USING btree ("company_id", "employee_id");

DROP INDEX IF EXISTS "safety_reporting_masters_company_code_uidx";
DROP INDEX IF EXISTS "kaizen_categories_company_code_uidx";

CREATE INDEX IF NOT EXISTS "safety_reporting_masters_company_code_idx"
ON "safety_reporting_masters" USING btree ("company_id", "safety_category_code");

CREATE INDEX IF NOT EXISTS "kaizen_categories_company_code_idx"
ON "kaizen_categories" USING btree ("company_id", "kaizen_category_code");

CREATE TABLE IF NOT EXISTS "measuring_point_readings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "point_id" uuid NOT NULL,
  "equipment_id" uuid,
  "operational_log_id" uuid,
  "point_code" varchar(80) NOT NULL,
  "equipment_code_snapshot" varchar(80),
  "equipment_name_snapshot" varchar(160),
  "measurement_name_snapshot" varchar(180) NOT NULL,
  "measurement_unit_snapshot" varchar(40) NOT NULL,
  "measured_value" numeric(16, 4) NOT NULL,
  "target_value_snapshot" numeric(14, 4),
  "lower_limit_snapshot" numeric(14, 4),
  "upper_limit_snapshot" numeric(14, 4),
  "deviation_from_target" numeric(16, 4),
  "deviation_percent" numeric(10, 4),
  "measurement_status" varchar(40) DEFAULT 'NORMAL' NOT NULL,
  "alert_severity_snapshot" varchar(40) DEFAULT 'MEDIUM' NOT NULL,
  "is_alert" boolean DEFAULT false NOT NULL,
  "reported_by_id" uuid,
  "reported_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "meter_counter_readings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "counter_id" uuid NOT NULL,
  "equipment_id" uuid,
  "operational_log_id" uuid,
  "counter_code" varchar(80) NOT NULL,
  "equipment_code_snapshot" varchar(80),
  "location_snapshot" varchar(160),
  "counter_name_snapshot" varchar(180) NOT NULL,
  "counter_unit_snapshot" varchar(40) NOT NULL,
  "meter_type_snapshot" varchar(100) NOT NULL,
  "current_reading" numeric(16, 4) NOT NULL,
  "previous_reading" numeric(16, 4),
  "consumption_delta" numeric(16, 4),
  "previous_reading_at" timestamp with time zone,
  "expected_daily_consumption_snapshot" numeric(16, 4),
  "expected_consumption_for_period" numeric(16, 4),
  "deviation" numeric(16, 4),
  "deviation_percent" numeric(10, 4),
  "alert_deviation_pct_snapshot" numeric(8, 2),
  "reset_value_snapshot" numeric(16, 4),
  "counter_status" varchar(40) DEFAULT 'NORMAL' NOT NULL,
  "is_alert" boolean DEFAULT false NOT NULL,
  "reported_by_id" uuid,
  "reported_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "measuring_point_readings" ADD COLUMN IF NOT EXISTS "report_log_id" varchar(80);
ALTER TABLE "meter_counter_readings" ADD COLUMN IF NOT EXISTS "report_log_id" varchar(80);

UPDATE "measuring_point_readings"
SET "report_log_id" = 'MP-' || to_char("reported_at", 'YYYYMMDDHH24MISS') || '-' || upper(substr("id"::text, 1, 4))
WHERE "report_log_id" IS NULL;

UPDATE "meter_counter_readings"
SET "report_log_id" = 'CT-' || to_char("reported_at", 'YYYYMMDDHH24MISS') || '-' || upper(substr("id"::text, 1, 4))
WHERE "report_log_id" IS NULL;

ALTER TABLE "measuring_point_readings" ALTER COLUMN "report_log_id" SET NOT NULL;
ALTER TABLE "meter_counter_readings" ALTER COLUMN "report_log_id" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "measuring_point_readings_company_report_log_uidx"
ON "measuring_point_readings" USING btree ("company_id", "report_log_id");

CREATE UNIQUE INDEX IF NOT EXISTS "meter_counter_readings_company_report_log_uidx"
ON "meter_counter_readings" USING btree ("company_id", "report_log_id");

CREATE INDEX IF NOT EXISTS "measuring_point_readings_company_id_idx" ON "measuring_point_readings" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "measuring_point_readings_point_reported_at_idx" ON "measuring_point_readings" USING btree ("point_id", "reported_at");
CREATE INDEX IF NOT EXISTS "measuring_point_readings_alert_idx" ON "measuring_point_readings" USING btree ("company_id", "is_alert");
CREATE INDEX IF NOT EXISTS "measuring_point_readings_log_id_idx" ON "measuring_point_readings" USING btree ("operational_log_id");

CREATE INDEX IF NOT EXISTS "meter_counter_readings_company_id_idx" ON "meter_counter_readings" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "meter_counter_readings_counter_reported_at_idx" ON "meter_counter_readings" USING btree ("counter_id", "reported_at");
CREATE INDEX IF NOT EXISTS "meter_counter_readings_alert_idx" ON "meter_counter_readings" USING btree ("company_id", "is_alert");
CREATE INDEX IF NOT EXISTS "meter_counter_readings_log_id_idx" ON "meter_counter_readings" USING btree ("operational_log_id");
