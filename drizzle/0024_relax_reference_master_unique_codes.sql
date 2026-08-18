DROP INDEX IF EXISTS "safety_reporting_masters_company_code_uidx";
DROP INDEX IF EXISTS "kaizen_categories_company_code_uidx";

CREATE INDEX IF NOT EXISTS "safety_reporting_masters_company_code_idx"
ON "safety_reporting_masters" USING btree ("company_id", "safety_category_code");

CREATE INDEX IF NOT EXISTS "kaizen_categories_company_code_idx"
ON "kaizen_categories" USING btree ("company_id", "kaizen_category_code");
