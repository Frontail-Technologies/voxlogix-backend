CREATE TABLE "kaizen_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"kaizen_category_code" varchar(80),
	"category" varchar(180) NOT NULL,
	"department" varchar(160),
	"kaizen_status" varchar(80),
	"immediate_action_required" varchar(12),
	"notes" text,
	"status" varchar(40) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measuring_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"equipment_id" uuid,
	"point_code" varchar(80) NOT NULL,
	"equipment_code_snapshot" varchar(80),
	"equipment_name_snapshot" varchar(160),
	"measurement_name" varchar(180) NOT NULL,
	"measurement_unit" varchar(40) NOT NULL,
	"target_value" numeric(14, 4),
	"lower_limit" numeric(14, 4),
	"upper_limit" numeric(14, 4),
	"measurement_frequency" varchar(120),
	"alert_severity" varchar(40) DEFAULT 'MEDIUM' NOT NULL,
	"instrument_tag" varchar(120),
	"notes" text,
	"status" varchar(40) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meter_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"equipment_id" uuid,
	"counter_code" varchar(80) NOT NULL,
	"equipment_code_snapshot" varchar(80),
	"location" varchar(160),
	"counter_name" varchar(180) NOT NULL,
	"counter_unit" varchar(40) NOT NULL,
	"meter_type" varchar(100) NOT NULL,
	"reading_frequency" varchar(120),
	"initial_reading" numeric(16, 4),
	"reset_value" numeric(16, 4),
	"expected_daily_consumption" numeric(16, 4),
	"alert_deviation_pct" numeric(8, 2),
	"notes" text,
	"status" varchar(40) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "safety_reporting_masters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"safety_category_code" varchar(80),
	"incident_category" varchar(160) NOT NULL,
	"incident_type" varchar(180) NOT NULL,
	"severity_level" varchar(40) DEFAULT 'MEDIUM' NOT NULL,
	"requires_ppe" varchar(12) DEFAULT 'NO' NOT NULL,
	"ppe_type" varchar(160),
	"reportable" varchar(12) DEFAULT 'NO' NOT NULL,
	"immediate_action_required" varchar(12) DEFAULT 'NO' NOT NULL,
	"notes" text,
	"status" varchar(40) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_categories" ADD COLUMN "category_code" varchar(80);--> statement-breakpoint
ALTER TABLE "issue_categories" ADD COLUMN "equipment_function" varchar(160);--> statement-breakpoint
ALTER TABLE "issue_categories" ADD COLUMN "issue_status" varchar(80);--> statement-breakpoint
ALTER TABLE "issue_categories" ADD COLUMN "failure_mode" varchar(160);--> statement-breakpoint
ALTER TABLE "issue_categories" ADD COLUMN "spare_part_ref" varchar(160);--> statement-breakpoint
ALTER TABLE "issue_categories" ADD COLUMN "maintenance_type" varchar(120);--> statement-breakpoint
ALTER TABLE "issue_categories" ADD COLUMN "production_impact" varchar(120);--> statement-breakpoint
ALTER TABLE "issue_categories" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "section_code" varchar(80);--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "sub_location_code" varchar(80);--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "area_supervisor" varchar(160);--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "shift_details" varchar(160);--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "department" varchar(160);--> statement-breakpoint
ALTER TABLE "kaizen_categories" ADD CONSTRAINT "kaizen_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measuring_points" ADD CONSTRAINT "measuring_points_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measuring_points" ADD CONSTRAINT "measuring_points_equipment_id_equipment_assets_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_counters" ADD CONSTRAINT "meter_counters_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_counters" ADD CONSTRAINT "meter_counters_equipment_id_equipment_assets_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_reporting_masters" ADD CONSTRAINT "safety_reporting_masters_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kaizen_categories_company_id_idx" ON "kaizen_categories" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "kaizen_categories_category_idx" ON "kaizen_categories" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "kaizen_categories_company_code_uidx" ON "kaizen_categories" USING btree ("company_id","kaizen_category_code");--> statement-breakpoint
CREATE INDEX "measuring_points_company_id_idx" ON "measuring_points" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "measuring_points_equipment_id_idx" ON "measuring_points" USING btree ("equipment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "measuring_points_company_point_code_uidx" ON "measuring_points" USING btree ("company_id","point_code");--> statement-breakpoint
CREATE INDEX "meter_counters_company_id_idx" ON "meter_counters" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "meter_counters_equipment_id_idx" ON "meter_counters" USING btree ("equipment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meter_counters_company_counter_code_uidx" ON "meter_counters" USING btree ("company_id","counter_code");--> statement-breakpoint
CREATE INDEX "safety_reporting_masters_company_id_idx" ON "safety_reporting_masters" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "safety_reporting_masters_incident_category_idx" ON "safety_reporting_masters" USING btree ("incident_category");--> statement-breakpoint
CREATE UNIQUE INDEX "safety_reporting_masters_company_code_uidx" ON "safety_reporting_masters" USING btree ("company_id","safety_category_code");--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_assets_company_code_uidx" ON "equipment_assets" USING btree ("company_id","equipment_code");--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_categories_company_name_uidx" ON "equipment_categories" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "locations_section_code_idx" ON "locations" USING btree ("section_code");