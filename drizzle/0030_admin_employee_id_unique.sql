-- Migration: enforce DB-level uniqueness for (company_id, employee_id) in admins.
--
-- Uses a PARTIAL unique index that excludes NULL employee_ids, so:
--   - Records without an employee_id assigned can still coexist (multiple NULLs per company are fine).
--   - Non-null employee_ids are unique per company at the DB level, not just application-level.
--
-- Safety gate: aborts the migration if any existing duplicate (company_id, employee_id) pairs
-- are present. The application import service already prevents this, but the check makes the
-- migration idempotent-safe for databases with historical data or concurrent edge cases.

DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT company_id, employee_id
    FROM admins
    WHERE employee_id IS NOT NULL
    GROUP BY company_id, employee_id
    HAVING COUNT(*) > 1
  ) duplicates;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Migration aborted: found % duplicate (company_id, employee_id) pair(s) in admins. '
      'Resolve these duplicates manually before applying this migration.',
      dup_count;
  END IF;
END $$;

-- Drop the old non-unique index (replaced by the unique one below).
DROP INDEX IF EXISTS "admins_company_employee_id_idx";

-- Create the partial unique index. NULL employee_ids are excluded from the uniqueness
-- constraint, preserving records that legitimately have no employee ID assigned.
CREATE UNIQUE INDEX IF NOT EXISTS "admins_company_employee_id_uidx"
  ON "admins" ("company_id", "employee_id")
  WHERE "employee_id" IS NOT NULL;
