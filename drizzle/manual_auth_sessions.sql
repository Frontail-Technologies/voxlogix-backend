-- Manually authored, NOT registered in drizzle's migration journal.
--
-- Why: `npm run db:generate` at this point in the project's history produces
-- a diff that also tries to CREATE TABLE "measuring_point_readings" and
-- "meter_counter_readings" — both already exist and are populated in the
-- real database. This means drizzle-kit's tracked snapshot (drizzle/meta/)
-- has been out of sync with the actual DB schema since before this change
-- (likely those two tables were applied via `db:push` at some point without
-- a corresponding migration ever being generated/committed). That drift is
-- pre-existing and out of scope for this pass — running the auto-generated
-- migration as-is would fail (or worse) against a DB that already has those
-- tables. See the security hardening report for the recommended follow-up
-- (regenerate a clean baseline snapshot against the real DB schema).
--
-- This file contains ONLY the new, unambiguously-additive table this pass
-- actually needs. Apply it directly (e.g. `psql $DATABASE_URL -f
-- drizzle/manual_auth_sessions.sql`) in any environment that doesn't yet
-- have `auth_sessions` — safe to run once; re-running will fail cleanly on
-- the existing table/constraint names rather than silently no-op, so don't
-- run it twice against the same database.

CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"user_agent" text
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "auth_sessions_admin_id_idx" ON "auth_sessions" USING btree ("admin_id");
