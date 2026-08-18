ALTER TABLE "admins"
ADD COLUMN IF NOT EXISTS "employee_id" varchar(80);

CREATE INDEX IF NOT EXISTS "admins_company_employee_id_idx"
ON "admins" USING btree ("company_id", "employee_id");
