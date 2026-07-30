CREATE TABLE "module_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"description" text,
	"status" varchar(40) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "module_categories_name_unique" UNIQUE("name"),
	CONSTRAINT "module_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "module_categories_name_idx" ON "module_categories" USING btree ("name");
--> statement-breakpoint
INSERT INTO "module_categories" ("name", "slug", "description", "status")
VALUES
  ('Administration', 'administration', 'Configuration and user-management modules.', 'ACTIVE'),
  ('Operational', 'operational', 'Core operational modules used by company teams.', 'ACTIVE'),
  ('Reports', 'reports', 'Reporting and analytics modules.', 'ACTIVE')
ON CONFLICT ("slug") DO NOTHING;
