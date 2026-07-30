import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { moduleStatusEnum } from "@/db/schema/enums.schema";

export const moduleTypes = pgTable(
  "module_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull().unique(),
    slug: varchar("slug", { length: 140 }).notNull().unique(),
    description: text("description"),
    status: varchar("status", { length: 40 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    nameIndex: index("module_types_name_idx").on(table.name),
  }),
);

export const moduleCategories = pgTable(
  "module_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull().unique(),
    slug: varchar("slug", { length: 140 }).notNull().unique(),
    description: text("description"),
    status: varchar("status", { length: 40 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    nameIndex: index("module_categories_name_idx").on(table.name),
  }),
);

export const modules = pgTable(
  "modules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull().unique(),
    moduleTypeId: uuid("module_type_id")
      .notNull()
      .references(() => moduleTypes.id),
    category: varchar("category", { length: 80 }).notNull().default("Operational"),
    status: moduleStatusEnum("status").notNull().default("INACTIVE"),
    availabilityText: varchar("availability_text", { length: 120 })
      .notNull()
      .default("Coming Soon"),
    icon: varchar("icon", { length: 80 }).notNull(),
    color: varchar("color", { length: 20 }).notNull().default("#f7b51e"),
    mediaUrl: text("media_url"),
    mediaKey: text("media_key"),
    description: text("description"),
    promptPreview: text("prompt_preview"),
    voiceEnabled: boolean("voice_enabled").notNull().default(true),
    feedEnabled: boolean("feed_enabled").notNull().default(true),
    feedOnlyOnAlert: boolean("feed_only_on_alert").notNull().default(false),
    requiresVoicePlayback: boolean("requires_voice_playback").notNull().default(true),
    maxAttachments: integer("max_attachments").notNull().default(5),
    fieldsCount: integer("fields_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    nameIndex: index("modules_name_idx").on(table.name),
    moduleTypeIndex: index("modules_module_type_id_idx").on(table.moduleTypeId),
    statusIndex: index("modules_status_idx").on(table.status),
  }),
);

export const moduleFields = pgTable(
  "module_fields",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 160 }).notNull(),
    key: varchar("key", { length: 160 }).notNull(),
    type: varchar("type", { length: 80 }).notNull(),
    required: boolean("required").notNull().default(false),
    aiExtract: boolean("ai_extract").notNull().default(true),
    sourceType: varchar("source_type", { length: 40 }).notNull().default("ai"),
    sourceKey: varchar("source_key", { length: 120 }),
    feedVisible: boolean("feed_visible").notNull().default(true),
    reportVisible: boolean("report_visible").notNull().default(true),
    validationRules: jsonb("validation_rules").$type<Record<string, unknown> | null>().default(null),
    sortOrder: integer("sort_order").notNull().default(1),
    options: jsonb("options").$type<string[] | null>().default(null),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    moduleIndex: index("module_fields_module_id_idx").on(table.moduleId),
    moduleKeyIndex: index("module_fields_module_id_key_idx").on(
      table.moduleId,
      table.key,
    ),
  }),
);

export const modulesRelations = relations(modules, ({ many, one }) => ({
  fields: many(moduleFields),
  moduleType: one(moduleTypes, {
    fields: [modules.moduleTypeId],
    references: [moduleTypes.id],
  }),
}));

export const moduleFieldsRelations = relations(moduleFields, ({ one }) => ({
  module: one(modules, {
    fields: [moduleFields.moduleId],
    references: [modules.id],
  }),
}));

export const moduleTypesRelations = relations(moduleTypes, ({ many }) => ({
  modules: many(modules),
}));

export const moduleCategoriesRelations = relations(moduleCategories, () => ({}));
