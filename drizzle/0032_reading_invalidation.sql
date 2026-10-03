ALTER TABLE "measuring_point_readings"
  ADD COLUMN "status" varchar(40) DEFAULT 'VALID' NOT NULL,
  ADD COLUMN "invalidated_at" timestamp with time zone,
  ADD COLUMN "invalidated_by_user_id" uuid,
  ADD COLUMN "invalidation_reason" varchar(500);

ALTER TABLE "meter_counter_readings"
  ADD COLUMN "status" varchar(40) DEFAULT 'VALID' NOT NULL,
  ADD COLUMN "invalidated_at" timestamp with time zone,
  ADD COLUMN "invalidated_by_user_id" uuid,
  ADD COLUMN "invalidation_reason" varchar(500);

ALTER TABLE "measuring_point_readings"
  ADD CONSTRAINT "measuring_point_readings_invalidated_by_user_id_admins_id_fk"
  FOREIGN KEY ("invalidated_by_user_id") REFERENCES "admins"("id") ON DELETE set null;

ALTER TABLE "meter_counter_readings"
  ADD CONSTRAINT "meter_counter_readings_invalidated_by_user_id_admins_id_fk"
  FOREIGN KEY ("invalidated_by_user_id") REFERENCES "admins"("id") ON DELETE set null;

CREATE INDEX "measuring_point_readings_point_status_reported_at_idx"
  ON "measuring_point_readings" ("point_id", "status", "reported_at");

CREATE INDEX "meter_counter_readings_counter_status_reported_at_idx"
  ON "meter_counter_readings" ("counter_id", "status", "reported_at");
