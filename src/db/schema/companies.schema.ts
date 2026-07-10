import { relations } from "drizzle-orm";
import { index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { admins } from "@/db/schema/admins.schema";
import { companyStatusEnum } from "@/db/schema/enums.schema";

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull().unique(),
    logo: varchar("logo", { length: 8 }),
    ownerName: varchar("owner_name", { length: 160 }).notNull(),
    ownerEmail: varchar("owner_email", { length: 255 }).notNull(),
    ownerPhone: varchar("owner_phone", { length: 32 }).notNull(),
    businessType: varchar("business_type", { length: 120 }).notNull(),
    plan: varchar("plan", { length: 80 }).notNull(),
    status: companyStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    nameIndex: index("companies_name_idx").on(table.name),
    statusIndex: index("companies_status_idx").on(table.status),
  }),
);

export const companiesRelations = relations(companies, ({ many }) => ({
  admins: many(admins),
}));
