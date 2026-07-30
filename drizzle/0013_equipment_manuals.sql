CREATE TABLE IF NOT EXISTS "equipment_manuals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "equipment_id" uuid NOT NULL,
  "created_by_id" uuid,
  "title" varchar(220) NOT NULL,
  "file_url" text,
  "file_key" text,
  "file_name" varchar(260),
  "mime_type" varchar(140),
  "file_size" integer,
  "status" varchar(40) DEFAULT 'READY' NOT NULL,
  "extracted_text" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "equipment_manual_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "manual_id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "equipment_id" uuid NOT NULL,
  "page_number" integer,
  "section_title" varchar(220),
  "chunk_text" text NOT NULL,
  "sort_order" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equipment_manuals" ADD CONSTRAINT "equipment_manuals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equipment_manuals" ADD CONSTRAINT "equipment_manuals_equipment_id_equipment_assets_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equipment_manuals" ADD CONSTRAINT "equipment_manuals_created_by_id_admins_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equipment_manual_chunks" ADD CONSTRAINT "equipment_manual_chunks_manual_id_equipment_manuals_id_fk" FOREIGN KEY ("manual_id") REFERENCES "public"."equipment_manuals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equipment_manual_chunks" ADD CONSTRAINT "equipment_manual_chunks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equipment_manual_chunks" ADD CONSTRAINT "equipment_manual_chunks_equipment_id_equipment_assets_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment_assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_manuals_company_id_idx" ON "equipment_manuals" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_manuals_equipment_id_idx" ON "equipment_manuals" USING btree ("equipment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_manuals_status_idx" ON "equipment_manuals" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_manual_chunks_manual_id_idx" ON "equipment_manual_chunks" USING btree ("manual_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_manual_chunks_equipment_id_idx" ON "equipment_manual_chunks" USING btree ("equipment_id");
