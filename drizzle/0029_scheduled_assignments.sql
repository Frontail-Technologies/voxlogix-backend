CREATE TABLE "scheduled_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" varchar(180) NOT NULL,
	"description" text,
	"assigned_to_user_id" uuid NOT NULL,
	"assigned_by_user_id" uuid NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" varchar(40) DEFAULT 'SCHEDULED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scheduled_assignments" ADD CONSTRAINT "scheduled_assignments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_assignments" ADD CONSTRAINT "scheduled_assignments_assigned_to_user_id_admins_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."admins"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_assignments" ADD CONSTRAINT "scheduled_assignments_assigned_by_user_id_admins_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."admins"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scheduled_assignments_company_id_idx" ON "scheduled_assignments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "scheduled_assignments_assignee_schedule_idx" ON "scheduled_assignments" USING btree ("assigned_to_user_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "scheduled_assignments_company_status_idx" ON "scheduled_assignments" USING btree ("company_id","status");