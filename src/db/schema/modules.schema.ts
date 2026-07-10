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

import { moduleStatusEnum, moduleTypeEnum } from "@/db/schema/enums.schema";

export const modules = pgTable(
  "modules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull().unique(),
    type: moduleTypeEnum("type").notNull(),
    category: varchar("category", { length: 80 }).notNull().default("Operational"),
    status: moduleStatusEnum("status").notNull().default("INACTIVE"),
    availabilityText: varchar("availability_text", { length: 120 })
      .notNull()
      .default("Coming Soon"),
    icon: varchar("icon", { length: 80 }).notNull(),
    color: varchar("color", { length: 20 }).notNull().default("#f7b51e"),
    description: text("description"),
    promptPreview: text("prompt_preview"),
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
    typeIndex: index("modules_type_idx").on(table.type),
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

export const modulesRelations = relations(modules, ({ many }) => ({
  fields: many(moduleFields),
}));

export const moduleFieldsRelations = relations(moduleFields, ({ one }) => ({
  module: one(modules, {
    fields: [moduleFields.moduleId],
    references: [modules.id],
  }),
}));
