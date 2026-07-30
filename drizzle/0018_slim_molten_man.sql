ALTER TABLE "modules" ADD COLUMN "voice_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "feed_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "feed_only_on_alert" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "requires_voice_playback" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "max_attachments" integer DEFAULT 5 NOT NULL;