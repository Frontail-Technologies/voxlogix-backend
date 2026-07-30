import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { admins } from "@/db/schema/admins.schema";
import { companies } from "@/db/schema/companies.schema";
import { equipmentAssets } from "@/db/schema/operational.schema";

export const aiChatSessions = pgTable(
  "ai_chat_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => admins.id, { onDelete: "cascade" }),
    equipmentId: uuid("equipment_id").references(() => equipmentAssets.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 220 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIndex: index("ai_chat_sessions_user_id_idx").on(table.userId),
    equipmentIndex: index("ai_chat_sessions_equipment_id_idx").on(table.equipmentId),
  }),
);

export const aiChatMessages = pgTable(
  "ai_chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => aiChatSessions.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionIndex: index("ai_chat_messages_session_id_idx").on(table.sessionId),
  }),
);

export const aiChatSessionsRelations = relations(aiChatSessions, ({ many }) => ({
  messages: many(aiChatMessages),
}));

export const aiChatMessagesRelations = relations(aiChatMessages, ({ one }) => ({
  session: one(aiChatSessions, {
    fields: [aiChatMessages.sessionId],
    references: [aiChatSessions.id],
  }),
}));
