CREATE TABLE "company_module_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_module_access" ADD CONSTRAINT "company_module_access_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_module_access" ADD CONSTRAINT "company_module_access_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_module_access_company_id_idx" ON "company_module_access" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_module_access_module_id_idx" ON "company_module_access" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "company_module_access_company_module_idx" ON "company_module_access" USING btree ("company_id","module_id");--> statement-breakpoint
ALTER TABLE "company_access_settings" DROP COLUMN "equipment_module_enabled";--> statement-breakpoint
ALTER TABLE "company_access_settings" DROP COLUMN "shift_module_enabled";--> statement-breakpoint
ALTER TABLE "company_access_settings" DROP COLUMN "safety_module_enabled";--> statement-breakpoint
ALTER TABLE "company_access_settings" DROP COLUMN "counter_meter_module_enabled";--> statement-breakpoint
ALTER TABLE "company_access_settings" DROP COLUMN "suggestion_module_enabled";