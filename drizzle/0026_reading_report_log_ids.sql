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
