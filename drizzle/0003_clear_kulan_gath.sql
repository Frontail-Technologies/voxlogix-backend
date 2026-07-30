CREATE TABLE "platform_general_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform_name" varchar(160) DEFAULT 'VoxLogiX' NOT NULL,
	"logo_url" text,
	"logo_key" text,
	"maintenance_mode_enabled" boolean DEFAULT false NOT NULL,
	"maintenance_message" text DEFAULT 'We are performing scheduled maintenance. Please check back soon.' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
