ALTER TABLE "module_fields" ADD COLUMN "source_type" varchar(40) DEFAULT 'ai' NOT NULL;
ALTER TABLE "module_fields" ADD COLUMN "source_key" varchar(120);
ALTER TABLE "module_fields" ADD COLUMN "feed_visible" boolean DEFAULT true NOT NULL;
ALTER TABLE "module_fields" ADD COLUMN "report_visible" boolean DEFAULT true NOT NULL;
ALTER TABLE "module_fields" ADD COLUMN "validation_rules" jsonb DEFAULT NULL;
