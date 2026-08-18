import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { companies } from "@/db/schema/companies.schema";
import { modules } from "@/db/schema/modules.schema";

export const companyAccessSettings = pgTable(
  "company_access_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .unique()
      .references(() => companies.id, { onDelete: "cascade" }),
    voiceLoggingEnabled: boolean("voice_logging_enabled").notNull().default(true),
    aiStructuredExtractionEnabled: boolean("ai_structured_extraction_enabled")
      .notNull()
      .default(true),
    imageUploadEnabled: boolean("image_upload_enabled").notNull().default(true),
    captureDeviceLocationEnabled: boolean("capture_device_location_enabled")
      .notNull()
      .default(false),
    reportsEnabled: boolean("reports_enabled").notNull().default(true),
    exportEnabled: boolean("export_enabled").notNull().default(true),
    userCreationLimit: integer("user_creation_limit").notNull().default(75),
    aiUsageLimitMinutes: integer("ai_usage_limit_minutes")
      .notNull()
      .default(1500),
    storageLimitGb: integer("storage_limit_gb").notNull().default(500),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    companyIndex: index("company_access_settings_company_id_idx").on(table.companyId),
  }),
);


export const companyModuleAccess = pgTable(
  "company_module_access",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    companyIndex: index("company_module_access_company_id_idx").on(table.companyId),
    moduleIndex: index("company_module_access_module_id_idx").on(table.moduleId),
    companyModuleIndex: index("company_module_access_company_module_idx").on(
      table.companyId,
      table.moduleId,
    ),
  }),
);
export const platformActivities = pgTable(
  "platform_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    event: text("event").notNull(),
    area: varchar("area", { length: 80 }).notNull(),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    companyNameSnapshot: varchar("company_name_snapshot", { length: 160 }),
    userDisplayName: varchar("user_display_name", { length: 160 }).notNull(),
    action: varchar("action", { length: 80 }).notNull(),
    status: varchar("status", { length: 80 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    areaIndex: index("platform_activities_area_idx").on(table.area),
    actionIndex: index("platform_activities_action_idx").on(table.action),
    companyIndex: index("platform_activities_company_id_idx").on(table.companyId),
    occurredAtIndex: index("platform_activities_occurred_at_idx").on(table.occurredAt),
  }),
);

export const companyAiUsageDaily = pgTable(
  "company_ai_usage_daily",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    usageDate: date("usage_date", { mode: "date" }).notNull(),
    aiLogs: integer("ai_logs").notNull().default(0),
    failedRequests: integer("failed_requests").notNull().default(0),
    estimatedCostCents: integer("estimated_cost_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    companyIndex: index("company_ai_usage_daily_company_id_idx").on(table.companyId),
    usageDateIndex: index("company_ai_usage_daily_usage_date_idx").on(table.usageDate),
  }),
);


export const platformGeneralSettings = pgTable("platform_general_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  platformName: varchar("platform_name", { length: 160 })
    .notNull()
    .default("VoxLogiX"),
  logoUrl: text("logo_url"),
  logoKey: text("logo_key"),
  maintenanceModeEnabled: boolean("maintenance_mode_enabled")
    .notNull()
    .default(false),
  maintenanceMessage: text("maintenance_message")
    .notNull()
    .default("We are performing scheduled maintenance. Please check back soon."),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const aiSettings = pgTable("ai_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: varchar("provider", { length: 120 }).notNull().default("OpenAI"),
  defaultModel: varchar("default_model", { length: 120 })
    .notNull()
    .default("gpt-4.1-mini"),
  apiKeyName: varchar("api_key_name", { length: 160 })
    .notNull()
    .default("Production OpenAI Key"),
  apiKey: text("api_key").notNull().default("sk-voxlogix-demo-key"),
  keyStatus: varchar("key_status", { length: 80 }).notNull().default("Disabled"),
  isDefault: boolean("is_default").notNull().default(false),
  structuredExtractionEnabled: boolean("structured_extraction_enabled")
    .notNull()
    .default(true),
  usageCostAlertsEnabled: boolean("usage_cost_alerts_enabled")
    .notNull()
    .default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const companyAccessSettingsRelations = relations(
  companyAccessSettings,
  ({ one }) => ({
    company: one(companies, {
      fields: [companyAccessSettings.companyId],
      references: [companies.id],
    }),
  }),
);

export const companyModuleAccessRelations = relations(
  companyModuleAccess,
  ({ one }) => ({
    company: one(companies, {
      fields: [companyModuleAccess.companyId],
      references: [companies.id],
    }),
    module: one(modules, {
      fields: [companyModuleAccess.moduleId],
      references: [modules.id],
    }),
  }),
);

export const platformActivitiesRelations = relations(
  platformActivities,
  ({ one }) => ({
    company: one(companies, {
      fields: [platformActivities.companyId],
      references: [companies.id],
    }),
  }),
);

export const companyAiUsageDailyRelations = relations(
  companyAiUsageDaily,
  ({ one }) => ({
    company: one(companies, {
      fields: [companyAiUsageDaily.companyId],
      references: [companies.id],
    }),
  }),
);
