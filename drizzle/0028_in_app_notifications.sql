CREATE TABLE "in_app_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"type" varchar(60) NOT NULL,
	"title" varchar(180) NOT NULL,
	"message" text NOT NULL,
	"related_entity_type" varchar(80),
	"related_entity_id" uuid,
	"related_route" varchar(500),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_recipient_user_id_admins_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_created_by_user_id_admins_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "in_app_notifications_company_id_idx" ON "in_app_notifications" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX "in_app_notifications_recipient_created_idx" ON "in_app_notifications" USING btree ("recipient_user_id","created_at");
--> statement-breakpoint
CREATE INDEX "in_app_notifications_recipient_read_idx" ON "in_app_notifications" USING btree ("recipient_user_id","read_at");
