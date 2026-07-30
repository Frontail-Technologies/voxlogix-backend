CREATE TABLE "equipment_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"location_id" uuid,
	"equipment_code" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"category" varchar(120) DEFAULT 'Equipment' NOT NULL,
	"section" varchar(160) NOT NULL,
	"sub_location" varchar(160) NOT NULL,
	"make_brand" varchar(160),
	"model_number" varchar(160),
	"criticality" varchar(40) DEFAULT 'MEDIUM' NOT NULL,
	"status" varchar(60) DEFAULT 'ACTIVE' NOT NULL,
	"image_url" text,
	"notes" text,
	"commissioned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"module_type" varchar(80) DEFAULT 'EQUIPMENT_LOG' NOT NULL,
	"severity_default" varchar(40) DEFAULT 'MEDIUM' NOT NULL,
	"status" varchar(40) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"plant" varchar(160) NOT NULL,
	"unit" varchar(160),
	"section" varchar(160) NOT NULL,
	"sub_location" varchar(160) NOT NULL,
	"status" varchar(40) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "log_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"log_id" uuid NOT NULL,
	"url" text NOT NULL,
	"key" text,
	"file_name" varchar(220),
	"mime_type" varchar(120),
	"label" varchar(120),
	"sort_order" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "log_timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"log_id" uuid NOT NULL,
	"actor_id" uuid,
	"actor_name_snapshot" varchar(160) NOT NULL,
	"event" varchar(180) NOT NULL,
	"status" varchar(60),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operational_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"module_id" uuid,
	"equipment_id" uuid,
	"created_by_id" uuid,
	"assigned_planner_id" uuid,
	"log_number" varchar(80) NOT NULL,
	"module_type" varchar(80) NOT NULL,
	"title" varchar(220) NOT NULL,
	"description" text,
	"transcript" text,
	"issue_category" varchar(160),
	"severity" varchar(40) DEFAULT 'MEDIUM' NOT NULL,
	"status" varchar(60) DEFAULT 'SUBMITTED' NOT NULL,
	"ai_processed" integer DEFAULT 0 NOT NULL,
	"voice_duration_seconds" integer DEFAULT 0 NOT NULL,
	"downtime_minutes" integer DEFAULT 0 NOT NULL,
	"extracted_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"captured_latitude" numeric(10, 7),
	"captured_longitude" numeric(10, 7),
	"captured_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "equipment_assets" ADD CONSTRAINT "equipment_assets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_assets" ADD CONSTRAINT "equipment_assets_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_categories" ADD CONSTRAINT "issue_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_attachments" ADD CONSTRAINT "log_attachments_log_id_operational_logs_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."operational_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_timeline_events" ADD CONSTRAINT "log_timeline_events_log_id_operational_logs_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."operational_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_timeline_events" ADD CONSTRAINT "log_timeline_events_actor_id_admins_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_logs" ADD CONSTRAINT "operational_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_logs" ADD CONSTRAINT "operational_logs_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_logs" ADD CONSTRAINT "operational_logs_equipment_id_equipment_assets_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_logs" ADD CONSTRAINT "operational_logs_created_by_id_admins_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_logs" ADD CONSTRAINT "operational_logs_assigned_planner_id_admins_id_fk" FOREIGN KEY ("assigned_planner_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "equipment_assets_company_id_idx" ON "equipment_assets" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "equipment_assets_code_idx" ON "equipment_assets" USING btree ("equipment_code");--> statement-breakpoint
CREATE INDEX "equipment_assets_status_idx" ON "equipment_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "issue_categories_company_id_idx" ON "issue_categories" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "issue_categories_module_type_idx" ON "issue_categories" USING btree ("module_type");--> statement-breakpoint
CREATE INDEX "locations_company_id_idx" ON "locations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "locations_section_idx" ON "locations" USING btree ("section");--> statement-breakpoint
CREATE INDEX "log_attachments_log_id_idx" ON "log_attachments" USING btree ("log_id");--> statement-breakpoint
CREATE INDEX "log_timeline_events_log_id_idx" ON "log_timeline_events" USING btree ("log_id");--> statement-breakpoint
CREATE INDEX "operational_logs_company_id_idx" ON "operational_logs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "operational_logs_module_type_idx" ON "operational_logs" USING btree ("module_type");--> statement-breakpoint
CREATE INDEX "operational_logs_status_idx" ON "operational_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "operational_logs_severity_idx" ON "operational_logs" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "operational_logs_created_at_idx" ON "operational_logs" USING btree ("created_at");