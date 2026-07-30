CREATE TABLE "module_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"description" text,
	"status" varchar(40) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "module_types_name_unique" UNIQUE("name"),
	CONSTRAINT "module_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
DROP INDEX "modules_type_idx";--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "module_type_id" uuid;--> statement-breakpoint
CREATE INDEX "module_types_name_idx" ON "module_types" USING btree ("name");--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_module_type_id_module_types_id_fk" FOREIGN KEY ("module_type_id") REFERENCES "public"."module_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "modules_module_type_id_idx" ON "modules" USING btree ("module_type_id");