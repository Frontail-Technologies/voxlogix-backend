ALTER TABLE "companies" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "logo_key" text;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "avatar_key" text;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "media_url" text;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "media_key" text;--> statement-breakpoint
ALTER TABLE "equipment_assets" ADD COLUMN "manual_url" text;--> statement-breakpoint
ALTER TABLE "equipment_assets" ADD COLUMN "manual_text" text;