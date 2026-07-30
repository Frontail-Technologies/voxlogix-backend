ALTER TABLE "modules" ALTER COLUMN "module_type_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "modules" DROP COLUMN "type";--> statement-breakpoint
DROP TYPE "public"."module_type";