CREATE TABLE "measuring_point_readings" (
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

CREATE TABLE "meter_counter_readings" (
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

ALTER TABLE "measuring_point_readings" ADD CONSTRAINT "measuring_point_readings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "measuring_point_readings" ADD CONSTRAINT "measuring_point_readings_point_id_measuring_points_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."measuring_points"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "measuring_point_readings" ADD CONSTRAINT "measuring_point_readings_equipment_id_equipment_assets_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_assets"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "measuring_point_readings" ADD CONSTRAINT "measuring_point_readings_operational_log_id_operational_logs_id_fk" FOREIGN KEY ("operational_log_id") REFERENCES "public"."operational_logs"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "measuring_point_readings" ADD CONSTRAINT "measuring_point_readings_reported_by_id_admins_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "meter_counter_readings" ADD CONSTRAINT "meter_counter_readings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "meter_counter_readings" ADD CONSTRAINT "meter_counter_readings_counter_id_meter_counters_id_fk" FOREIGN KEY ("counter_id") REFERENCES "public"."meter_counters"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "meter_counter_readings" ADD CONSTRAINT "meter_counter_readings_equipment_id_equipment_assets_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_assets"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "meter_counter_readings" ADD CONSTRAINT "meter_counter_readings_operational_log_id_operational_logs_id_fk" FOREIGN KEY ("operational_log_id") REFERENCES "public"."operational_logs"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "meter_counter_readings" ADD CONSTRAINT "meter_counter_readings_reported_by_id_admins_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX "measuring_point_readings_company_id_idx" ON "measuring_point_readings" USING btree ("company_id");
CREATE INDEX "measuring_point_readings_point_reported_at_idx" ON "measuring_point_readings" USING btree ("point_id", "reported_at");
CREATE INDEX "measuring_point_readings_alert_idx" ON "measuring_point_readings" USING btree ("company_id", "is_alert");
CREATE INDEX "measuring_point_readings_log_id_idx" ON "measuring_point_readings" USING btree ("operational_log_id");

CREATE INDEX "meter_counter_readings_company_id_idx" ON "meter_counter_readings" USING btree ("company_id");
CREATE INDEX "meter_counter_readings_counter_reported_at_idx" ON "meter_counter_readings" USING btree ("counter_id", "reported_at");
CREATE INDEX "meter_counter_readings_alert_idx" ON "meter_counter_readings" USING btree ("company_id", "is_alert");
CREATE INDEX "meter_counter_readings_log_id_idx" ON "meter_counter_readings" USING btree ("operational_log_id");
