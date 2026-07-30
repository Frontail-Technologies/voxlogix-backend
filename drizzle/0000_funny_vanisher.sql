CREATE TYPE "public"."company_status" AS ENUM('DEMO', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."module_status" AS ENUM('ACTIVE', 'INACTIVE', 'COMING_SOON');--> statement-breakpoint
CREATE TYPE "public"."module_type" AS ENUM('EQUIPMENT_LOG', 'SAFETY_LOG', 'MEASUREMENT_POINT', 'METER_COUNTER', 'SHIFT', 'SUGGESTION');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('MASTER', 'ADMIN', 'PLANNER', 'EXECUTION');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(180) NOT NULL,
	"logo" varchar(8),
	"owner_name" varchar(160) NOT NULL,
	"owner_email" varchar(255) NOT NULL,
	"owner_phone" varchar(32) NOT NULL,
	"business_type" varchar(120) NOT NULL,
	"plan" varchar(80) NOT NULL,
	"start_date" timestamp with time zone,
	"expiry_date" timestamp with time zone,
	"address" text,
	"notes" text,
	"status" "company_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "admin_login_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"logged_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"channel" varchar(80) DEFAULT 'Web session' NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"initials" varchar(8) NOT NULL,
	"username" varchar(80) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"role" "user_role" DEFAULT 'ADMIN' NOT NULL,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"password_hash" text NOT NULL,
	"require_password_reset" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"joined_on" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_username_unique" UNIQUE("username"),
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "module_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"label" varchar(160) NOT NULL,
	"key" varchar(160) NOT NULL,
	"type" varchar(80) NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"ai_extract" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 1 NOT NULL,
	"options" jsonb DEFAULT 'null'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(180) NOT NULL,
	"type" "module_type" NOT NULL,
	"category" varchar(80) DEFAULT 'Operational' NOT NULL,
	"status" "module_status" DEFAULT 'INACTIVE' NOT NULL,
	"availability_text" varchar(120) DEFAULT 'Coming Soon' NOT NULL,
	"icon" varchar(80) NOT NULL,
	"color" varchar(20) DEFAULT '#f7b51e' NOT NULL,
	"description" text,
	"prompt_preview" text,
	"fields_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "modules_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ai_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(120) DEFAULT 'OpenAI' NOT NULL,
	"default_model" varchar(120) DEFAULT 'gpt-4.1-mini' NOT NULL,
	"api_key_name" varchar(160) DEFAULT 'Production OpenAI Key' NOT NULL,
	"api_key" text DEFAULT 'sk-voxlogix-demo-key' NOT NULL,
	"key_status" varchar(80) DEFAULT 'Active' NOT NULL,
	"structured_extraction_enabled" boolean DEFAULT true NOT NULL,
	"usage_cost_alerts_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_access_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"voice_logging_enabled" boolean DEFAULT true NOT NULL,
	"ai_structured_extraction_enabled" boolean DEFAULT true NOT NULL,
	"image_upload_enabled" boolean DEFAULT true NOT NULL,
	"equipment_module_enabled" boolean DEFAULT true NOT NULL,
	"shift_module_enabled" boolean DEFAULT false NOT NULL,
	"safety_module_enabled" boolean DEFAULT false NOT NULL,
	"counter_meter_module_enabled" boolean DEFAULT false NOT NULL,
	"suggestion_module_enabled" boolean DEFAULT false NOT NULL,
	"reports_enabled" boolean DEFAULT true NOT NULL,
	"export_enabled" boolean DEFAULT true NOT NULL,
	"user_creation_limit" integer DEFAULT 75 NOT NULL,
	"ai_usage_limit_minutes" integer DEFAULT 1500 NOT NULL,
	"storage_limit_gb" integer DEFAULT 500 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_access_settings_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "company_ai_usage_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"usage_date" date NOT NULL,
	"voice_minutes" integer DEFAULT 0 NOT NULL,
	"ai_logs" integer DEFAULT 0 NOT NULL,
	"failed_requests" integer DEFAULT 0 NOT NULL,
	"estimated_cost_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event" text NOT NULL,
	"area" varchar(80) NOT NULL,
	"company_id" uuid,
	"company_name_snapshot" varchar(160),
	"user_display_name" varchar(160) NOT NULL,
	"action" varchar(80) NOT NULL,
	"status" varchar(80) NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_login_history" ADD CONSTRAINT "admin_login_history_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_fields" ADD CONSTRAINT "module_fields_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_access_settings" ADD CONSTRAINT "company_access_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_ai_usage_daily" ADD CONSTRAINT "company_ai_usage_daily_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_activities" ADD CONSTRAINT "platform_activities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_name_idx" ON "companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "companies_status_idx" ON "companies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "admin_login_history_admin_id_idx" ON "admin_login_history" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "admins_company_id_idx" ON "admins" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "admins_status_idx" ON "admins" USING btree ("status");--> statement-breakpoint
CREATE INDEX "admins_full_name_idx" ON "admins" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "module_fields_module_id_idx" ON "module_fields" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "module_fields_module_id_key_idx" ON "module_fields" USING btree ("module_id","key");--> statement-breakpoint
CREATE INDEX "modules_name_idx" ON "modules" USING btree ("name");--> statement-breakpoint
CREATE INDEX "modules_type_idx" ON "modules" USING btree ("type");--> statement-breakpoint
CREATE INDEX "modules_status_idx" ON "modules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "company_access_settings_company_id_idx" ON "company_access_settings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_ai_usage_daily_company_id_idx" ON "company_ai_usage_daily" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_ai_usage_daily_usage_date_idx" ON "company_ai_usage_daily" USING btree ("usage_date");--> statement-breakpoint
CREATE INDEX "platform_activities_area_idx" ON "platform_activities" USING btree ("area");--> statement-breakpoint
CREATE INDEX "platform_activities_action_idx" ON "platform_activities" USING btree ("action");--> statement-breakpoint
CREATE INDEX "platform_activities_company_id_idx" ON "platform_activities" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "platform_activities_occurred_at_idx" ON "platform_activities" USING btree ("occurred_at");