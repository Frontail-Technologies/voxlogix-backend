ALTER TABLE "operational_logs" ADD COLUMN "client_request_id" varchar(120);--> statement-breakpoint
CREATE UNIQUE INDEX "operational_logs_company_client_request_id_idx" ON "operational_logs" USING btree ("company_id","client_request_id");
