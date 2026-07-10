import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { companies } from "@/db/schema/companies.schema";
import { userRoleEnum, userStatusEnum } from "@/db/schema/enums.schema";

export const admins = pgTable(
  "admins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    initials: varchar("initials", { length: 8 }).notNull(),
    username: varchar("username", { length: 80 }).notNull().unique(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    phone: varchar("phone", { length: 32 }).notNull(),
    role: userRoleEnum("role").notNull().default("ADMIN"),
    status: userStatusEnum("status").notNull().default("ACTIVE"),
    passwordHash: text("password_hash").notNull(),
    requirePasswordReset: boolean("require_password_reset")
      .notNull()
      .default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    joinedOn: timestamp("joined_on", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    companyIndex: index("admins_company_id_idx").on(table.companyId),
    statusIndex: index("admins_status_idx").on(table.status),
    nameIndex: index("admins_full_name_idx").on(table.fullName),
  }),
);

export const adminLoginHistory = pgTable(
  "admin_login_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => admins.id, { onDelete: "cascade" }),
    loggedInAt: timestamp("logged_in_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    channel: varchar("channel", { length: 80 }).notNull().default("Web session"),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
  },
  (table) => ({
    adminIndex: index("admin_login_history_admin_id_idx").on(table.adminId),
  }),
);

export const adminsRelations = relations(admins, ({ one, many }) => ({
  company: one(companies, {
    fields: [admins.companyId],
    references: [companies.id],
  }),
  loginHistory: many(adminLoginHistory),
}));

export const adminLoginHistoryRelations = relations(
  adminLoginHistory,
  ({ one }) => ({
    admin: one(admins, {
      fields: [adminLoginHistory.adminId],
      references: [admins.id],
    }),
  }),
);
