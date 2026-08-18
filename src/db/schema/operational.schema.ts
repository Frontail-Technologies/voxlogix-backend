import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { admins } from "@/db/schema/admins.schema";
import { companies } from "@/db/schema/companies.schema";
import { modules } from "@/db/schema/modules.schema";

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    plant: varchar("plant", { length: 160 }).notNull(),
    unit: varchar("unit", { length: 160 }),
    sectionCode: varchar("section_code", { length: 80 }),
    section: varchar("section", { length: 160 }).notNull(),
    subLocationCode: varchar("sub_location_code", { length: 80 }),
    subLocation: varchar("sub_location", { length: 160 }).notNull(),
    areaSupervisor: varchar("area_supervisor", { length: 160 }),
    shiftDetails: varchar("shift_details", { length: 160 }),
    department: varchar("department", { length: 160 }),
    status: varchar("status", { length: 40 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    companyIndex: index("locations_company_id_idx").on(table.companyId),
    sectionIndex: index("locations_section_idx").on(table.section),
    sectionCodeIndex: index("locations_section_code_idx").on(table.sectionCode),
  }),
);

export const issueCategories = pgTable(
  "issue_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    categoryCode: varchar("category_code", { length: 80 }),
    name: varchar("name", { length: 160 }).notNull(),
    moduleType: varchar("module_type", { length: 80 }).notNull().default("EQUIPMENT_LOG"),
    equipmentFunction: varchar("equipment_function", { length: 160 }),
    issueStatus: varchar("issue_status", { length: 80 }),
    severityDefault: varchar("severity_default", { length: 40 }).notNull().default("MEDIUM"),
    failureMode: varchar("failure_mode", { length: 160 }),
    sparePartRef: varchar("spare_part_ref", { length: 160 }),
    maintenanceType: varchar("maintenance_type", { length: 120 }),
    productionImpact: varchar("production_impact", { length: 120 }),
    notes: text("notes"),
    status: varchar("status", { length: 40 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    companyIndex: index("issue_categories_company_id_idx").on(table.companyId),
    moduleTypeIndex: index("issue_categories_module_type_idx").on(table.moduleType),
  }),
);

export const safetyReportingMasters = pgTable(
  "safety_reporting_masters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    safetyCategoryCode: varchar("safety_category_code", { length: 80 }),
    incidentCategory: varchar("incident_category", { length: 160 }).notNull(),
    incidentType: varchar("incident_type", { length: 180 }).notNull(),
    severityLevel: varchar("severity_level", { length: 40 }).notNull().default("MEDIUM"),
    requiresPpe: varchar("requires_ppe", { length: 12 }).notNull().default("NO"),
    ppeType: varchar("ppe_type", { length: 160 }),
    reportable: varchar("reportable", { length: 12 }).notNull().default("NO"),
    immediateActionRequired: varchar("immediate_action_required", { length: 12 }).notNull().default("NO"),
    notes: text("notes"),
    status: varchar("status", { length: 40 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    companyIndex: index("safety_reporting_masters_company_id_idx").on(table.companyId),
    categoryIndex: index("safety_reporting_masters_incident_category_idx").on(table.incidentCategory),
    codeIndex: index("safety_reporting_masters_company_code_idx").on(
      table.companyId,
      table.safetyCategoryCode,
    ),
  }),
);

export const measuringPoints = pgTable(
  "measuring_points",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    equipmentId: uuid("equipment_id").references(() => equipmentAssets.id, { onDelete: "set null" }),
    pointCode: varchar("point_code", { length: 80 }).notNull(),
    equipmentCodeSnapshot: varchar("equipment_code_snapshot", { length: 80 }),
    equipmentNameSnapshot: varchar("equipment_name_snapshot", { length: 160 }),
    measurementName: varchar("measurement_name", { length: 180 }).notNull(),
    measurementUnit: varchar("measurement_unit", { length: 40 }).notNull(),
    targetValue: numeric("target_value", { precision: 14, scale: 4 }),
    lowerLimit: numeric("lower_limit", { precision: 14, scale: 4 }),
    upperLimit: numeric("upper_limit", { precision: 14, scale: 4 }),
    measurementFrequency: varchar("measurement_frequency", { length: 120 }),
    alertSeverity: varchar("alert_severity", { length: 40 }).notNull().default("MEDIUM"),
    instrumentTag: varchar("instrument_tag", { length: 120 }),
    notes: text("notes"),
    status: varchar("status", { length: 40 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    companyIndex: index("measuring_points_company_id_idx").on(table.companyId),
    equipmentIndex: index("measuring_points_equipment_id_idx").on(table.equipmentId),
    pointUniqueIndex: uniqueIndex("measuring_points_company_point_code_uidx").on(table.companyId, table.pointCode),
  }),
);

export const meterCounters = pgTable(
  "meter_counters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    equipmentId: uuid("equipment_id").references(() => equipmentAssets.id, { onDelete: "set null" }),
    counterCode: varchar("counter_code", { length: 80 }).notNull(),
    equipmentCodeSnapshot: varchar("equipment_code_snapshot", { length: 80 }),
    location: varchar("location", { length: 160 }),
    counterName: varchar("counter_name", { length: 180 }).notNull(),
    counterUnit: varchar("counter_unit", { length: 40 }).notNull(),
    meterType: varchar("meter_type", { length: 100 }).notNull(),
    readingFrequency: varchar("reading_frequency", { length: 120 }),
    initialReading: numeric("initial_reading", { precision: 16, scale: 4 }),
    resetValue: numeric("reset_value", { precision: 16, scale: 4 }),
    expectedDailyConsumption: numeric("expected_daily_consumption", { precision: 16, scale: 4 }),
    alertDeviationPct: numeric("alert_deviation_pct", { precision: 8, scale: 2 }),
    notes: text("notes"),
    status: varchar("status", { length: 40 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    companyIndex: index("meter_counters_company_id_idx").on(table.companyId),
    equipmentIndex: index("meter_counters_equipment_id_idx").on(table.equipmentId),
    counterUniqueIndex: uniqueIndex("meter_counters_company_counter_code_uidx").on(table.companyId, table.counterCode),
  }),
);

export const kaizenCategories = pgTable(
  "kaizen_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    kaizenCategoryCode: varchar("kaizen_category_code", { length: 80 }),
    category: varchar("category", { length: 180 }).notNull(),
    department: varchar("department", { length: 160 }),
    kaizenStatus: varchar("kaizen_status", { length: 80 }),
    immediateActionRequired: varchar("immediate_action_required", { length: 12 }),
    notes: text("notes"),
    status: varchar("status", { length: 40 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    companyIndex: index("kaizen_categories_company_id_idx").on(table.companyId),
    categoryIndex: index("kaizen_categories_category_idx").on(table.category),
    codeIndex: index("kaizen_categories_company_code_idx").on(table.companyId, table.kaizenCategoryCode),
  }),
);

export const equipmentCategories = pgTable(
  "equipment_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    companyIndex: index("equipment_categories_company_id_idx").on(table.companyId),
    companyNameUniqueIndex: uniqueIndex("equipment_categories_company_name_uidx").on(table.companyId, table.name),
  }),
);

export const equipmentAssets = pgTable(
  "equipment_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
    equipmentCode: varchar("equipment_code", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    category: varchar("category", { length: 120 }).notNull().default("Equipment"),
    section: varchar("section", { length: 160 }).notNull(),
    subLocation: varchar("sub_location", { length: 160 }).notNull(),
    makeBrand: varchar("make_brand", { length: 160 }),
    modelNumber: varchar("model_number", { length: 160 }),
    criticality: varchar("criticality", { length: 40 }).notNull().default("MEDIUM"),
    status: varchar("status", { length: 60 }).notNull().default("ACTIVE"),
    imageUrl: text("image_url"),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    mapUrl: text("map_url"),
    notes: text("notes"),
    manualUrl: text("manual_url"),
    manualText: text("manual_text"),
    commissionedAt: timestamp("commissioned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    companyIndex: index("equipment_assets_company_id_idx").on(table.companyId),
    codeIndex: index("equipment_assets_code_idx").on(table.equipmentCode),
    companyCodeUniqueIndex: uniqueIndex("equipment_assets_company_code_uidx").on(table.companyId, table.equipmentCode),
    statusIndex: index("equipment_assets_status_idx").on(table.status),
  }),
);

export const equipmentManuals = pgTable(
  "equipment_manuals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipmentAssets.id, { onDelete: "cascade" }),
    createdById: uuid("created_by_id").references(() => admins.id, { onDelete: "set null" }),
    title: varchar("title", { length: 220 }).notNull(),
    fileUrl: text("file_url"),
    fileKey: text("file_key"),
    fileName: varchar("file_name", { length: 260 }),
    mimeType: varchar("mime_type", { length: 140 }),
    fileSize: integer("file_size"),
    status: varchar("status", { length: 40 }).notNull().default("READY"),
    extractedText: text("extracted_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    companyIndex: index("equipment_manuals_company_id_idx").on(table.companyId),
    equipmentIndex: index("equipment_manuals_equipment_id_idx").on(table.equipmentId),
    statusIndex: index("equipment_manuals_status_idx").on(table.status),
  }),
);

export const equipmentManualChunks = pgTable(
  "equipment_manual_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    manualId: uuid("manual_id")
      .notNull()
      .references(() => equipmentManuals.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipmentAssets.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number"),
    sectionTitle: varchar("section_title", { length: 220 }),
    chunkText: text("chunk_text").notNull(),
    sortOrder: integer("sort_order").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    manualIndex: index("equipment_manual_chunks_manual_id_idx").on(table.manualId),
    equipmentIndex: index("equipment_manual_chunks_equipment_id_idx").on(table.equipmentId),
  }),
);

export const operationalLogs = pgTable(
  "operational_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id").references(() => modules.id, { onDelete: "set null" }),
    equipmentId: uuid("equipment_id").references(() => equipmentAssets.id, { onDelete: "set null" }),
    createdById: uuid("created_by_id").references(() => admins.id, { onDelete: "set null" }),
    assignedPlannerId: uuid("assigned_planner_id").references(() => admins.id, { onDelete: "set null" }),
    logNumber: varchar("log_number", { length: 80 }).notNull(),
    clientRequestId: varchar("client_request_id", { length: 120 }),
    moduleType: varchar("module_type", { length: 80 }).notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    description: text("description"),
    transcript: text("transcript"),
    issueCategory: varchar("issue_category", { length: 160 }),
    severity: varchar("severity", { length: 40 }).notNull().default("MEDIUM"),
    status: varchar("status", { length: 60 }).notNull().default("SUBMITTED"),
    aiProcessed: integer("ai_processed").notNull().default(0),
    voiceDurationSeconds: integer("voice_duration_seconds").notNull().default(0),
    voiceRecordingUrl: text("voice_recording_url"),
    voiceRecordingKey: text("voice_recording_key"),
    downtimeMinutes: integer("downtime_minutes").notNull().default(0),
    extractedFields: jsonb("extracted_fields").$type<Record<string, unknown>>().notNull().default({}),
    capturedLatitude: numeric("captured_latitude", { precision: 10, scale: 7 }),
    capturedLongitude: numeric("captured_longitude", { precision: 10, scale: 7 }),
    capturedAddress: text("captured_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    companyIndex: index("operational_logs_company_id_idx").on(table.companyId),
    moduleTypeIndex: index("operational_logs_module_type_idx").on(table.moduleType),
    statusIndex: index("operational_logs_status_idx").on(table.status),
    severityIndex: index("operational_logs_severity_idx").on(table.severity),
    createdAtIndex: index("operational_logs_created_at_idx").on(table.createdAt),
    clientRequestIdIndex: uniqueIndex("operational_logs_company_client_request_id_idx").on(
      table.companyId,
      table.clientRequestId,
    ),
  }),
);

export const measuringPointReadings = pgTable(
  "measuring_point_readings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    pointId: uuid("point_id")
      .notNull()
      .references(() => measuringPoints.id, { onDelete: "cascade" }),
    equipmentId: uuid("equipment_id").references(() => equipmentAssets.id, { onDelete: "set null" }),
    operationalLogId: uuid("operational_log_id").references(() => operationalLogs.id, { onDelete: "set null" }),
    pointCode: varchar("point_code", { length: 80 }).notNull(),
    equipmentCodeSnapshot: varchar("equipment_code_snapshot", { length: 80 }),
    equipmentNameSnapshot: varchar("equipment_name_snapshot", { length: 160 }),
    measurementNameSnapshot: varchar("measurement_name_snapshot", { length: 180 }).notNull(),
    measurementUnitSnapshot: varchar("measurement_unit_snapshot", { length: 40 }).notNull(),
    measuredValue: numeric("measured_value", { precision: 16, scale: 4 }).notNull(),
    targetValueSnapshot: numeric("target_value_snapshot", { precision: 14, scale: 4 }),
    lowerLimitSnapshot: numeric("lower_limit_snapshot", { precision: 14, scale: 4 }),
    upperLimitSnapshot: numeric("upper_limit_snapshot", { precision: 14, scale: 4 }),
    deviationFromTarget: numeric("deviation_from_target", { precision: 16, scale: 4 }),
    deviationPercent: numeric("deviation_percent", { precision: 10, scale: 4 }),
    measurementStatus: varchar("measurement_status", { length: 40 }).notNull().default("NORMAL"),
    alertSeveritySnapshot: varchar("alert_severity_snapshot", { length: 40 }).notNull().default("MEDIUM"),
    isAlert: boolean("is_alert").notNull().default(false),
    reportedById: uuid("reported_by_id").references(() => admins.id, { onDelete: "set null" }),
    reportedAt: timestamp("reported_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    companyIndex: index("measuring_point_readings_company_id_idx").on(table.companyId),
    pointTimeIndex: index("measuring_point_readings_point_reported_at_idx").on(table.pointId, table.reportedAt),
    alertIndex: index("measuring_point_readings_alert_idx").on(table.companyId, table.isAlert),
    logIndex: index("measuring_point_readings_log_id_idx").on(table.operationalLogId),
  }),
);

export const meterCounterReadings = pgTable(
  "meter_counter_readings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    counterId: uuid("counter_id")
      .notNull()
      .references(() => meterCounters.id, { onDelete: "cascade" }),
    equipmentId: uuid("equipment_id").references(() => equipmentAssets.id, { onDelete: "set null" }),
    operationalLogId: uuid("operational_log_id").references(() => operationalLogs.id, { onDelete: "set null" }),
    counterCode: varchar("counter_code", { length: 80 }).notNull(),
    equipmentCodeSnapshot: varchar("equipment_code_snapshot", { length: 80 }),
    locationSnapshot: varchar("location_snapshot", { length: 160 }),
    counterNameSnapshot: varchar("counter_name_snapshot", { length: 180 }).notNull(),
    counterUnitSnapshot: varchar("counter_unit_snapshot", { length: 40 }).notNull(),
    meterTypeSnapshot: varchar("meter_type_snapshot", { length: 100 }).notNull(),
    currentReading: numeric("current_reading", { precision: 16, scale: 4 }).notNull(),
    previousReading: numeric("previous_reading", { precision: 16, scale: 4 }),
    consumptionDelta: numeric("consumption_delta", { precision: 16, scale: 4 }),
    previousReadingAt: timestamp("previous_reading_at", { withTimezone: true }),
    expectedDailyConsumptionSnapshot: numeric("expected_daily_consumption_snapshot", { precision: 16, scale: 4 }),
    expectedConsumptionForPeriod: numeric("expected_consumption_for_period", { precision: 16, scale: 4 }),
    deviation: numeric("deviation", { precision: 16, scale: 4 }),
    deviationPercent: numeric("deviation_percent", { precision: 10, scale: 4 }),
    alertDeviationPctSnapshot: numeric("alert_deviation_pct_snapshot", { precision: 8, scale: 2 }),
    resetValueSnapshot: numeric("reset_value_snapshot", { precision: 16, scale: 4 }),
    counterStatus: varchar("counter_status", { length: 40 }).notNull().default("NORMAL"),
    isAlert: boolean("is_alert").notNull().default(false),
    reportedById: uuid("reported_by_id").references(() => admins.id, { onDelete: "set null" }),
    reportedAt: timestamp("reported_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    companyIndex: index("meter_counter_readings_company_id_idx").on(table.companyId),
    counterTimeIndex: index("meter_counter_readings_counter_reported_at_idx").on(table.counterId, table.reportedAt),
    alertIndex: index("meter_counter_readings_alert_idx").on(table.companyId, table.isAlert),
    logIndex: index("meter_counter_readings_log_id_idx").on(table.operationalLogId),
  }),
);

export const logAttachments = pgTable(
  "log_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    logId: uuid("log_id")
      .notNull()
      .references(() => operationalLogs.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    key: text("key"),
    fileName: varchar("file_name", { length: 220 }),
    mimeType: varchar("mime_type", { length: 120 }),
    label: varchar("label", { length: 120 }),
    sortOrder: integer("sort_order").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    logIndex: index("log_attachments_log_id_idx").on(table.logId),
  }),
);

export const logTimelineEvents = pgTable(
  "log_timeline_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    logId: uuid("log_id")
      .notNull()
      .references(() => operationalLogs.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => admins.id, { onDelete: "set null" }),
    actorNameSnapshot: varchar("actor_name_snapshot", { length: 160 }).notNull(),
    event: varchar("event", { length: 180 }).notNull(),
    status: varchar("status", { length: 60 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    logIndex: index("log_timeline_events_log_id_idx").on(table.logId),
  }),
);

export const locationsRelations = relations(locations, ({ one, many }) => ({
  company: one(companies, { fields: [locations.companyId], references: [companies.id] }),
  equipment: many(equipmentAssets),
}));

export const issueCategoriesRelations = relations(issueCategories, ({ one }) => ({
  company: one(companies, { fields: [issueCategories.companyId], references: [companies.id] }),
}));

export const safetyReportingMastersRelations = relations(safetyReportingMasters, ({ one }) => ({
  company: one(companies, { fields: [safetyReportingMasters.companyId], references: [companies.id] }),
}));

export const equipmentCategoriesRelations = relations(equipmentCategories, ({ one }) => ({
  company: one(companies, { fields: [equipmentCategories.companyId], references: [companies.id] }),
}));

export const measuringPointsRelations = relations(measuringPoints, ({ one }) => ({
  company: one(companies, { fields: [measuringPoints.companyId], references: [companies.id] }),
  equipment: one(equipmentAssets, { fields: [measuringPoints.equipmentId], references: [equipmentAssets.id] }),
}));

export const measuringPointReadingsRelations = relations(measuringPointReadings, ({ one }) => ({
  company: one(companies, { fields: [measuringPointReadings.companyId], references: [companies.id] }),
  point: one(measuringPoints, { fields: [measuringPointReadings.pointId], references: [measuringPoints.id] }),
  equipment: one(equipmentAssets, { fields: [measuringPointReadings.equipmentId], references: [equipmentAssets.id] }),
  log: one(operationalLogs, { fields: [measuringPointReadings.operationalLogId], references: [operationalLogs.id] }),
  reportedBy: one(admins, { fields: [measuringPointReadings.reportedById], references: [admins.id] }),
}));

export const meterCountersRelations = relations(meterCounters, ({ one }) => ({
  company: one(companies, { fields: [meterCounters.companyId], references: [companies.id] }),
  equipment: one(equipmentAssets, { fields: [meterCounters.equipmentId], references: [equipmentAssets.id] }),
}));

export const meterCounterReadingsRelations = relations(meterCounterReadings, ({ one }) => ({
  company: one(companies, { fields: [meterCounterReadings.companyId], references: [companies.id] }),
  counter: one(meterCounters, { fields: [meterCounterReadings.counterId], references: [meterCounters.id] }),
  equipment: one(equipmentAssets, { fields: [meterCounterReadings.equipmentId], references: [equipmentAssets.id] }),
  log: one(operationalLogs, { fields: [meterCounterReadings.operationalLogId], references: [operationalLogs.id] }),
  reportedBy: one(admins, { fields: [meterCounterReadings.reportedById], references: [admins.id] }),
}));

export const kaizenCategoriesRelations = relations(kaizenCategories, ({ one }) => ({
  company: one(companies, { fields: [kaizenCategories.companyId], references: [companies.id] }),
}));

export const equipmentAssetsRelations = relations(equipmentAssets, ({ one, many }) => ({
  company: one(companies, { fields: [equipmentAssets.companyId], references: [companies.id] }),
  location: one(locations, { fields: [equipmentAssets.locationId], references: [locations.id] }),
  logs: many(operationalLogs),
  manuals: many(equipmentManuals),
}));

export const equipmentManualsRelations = relations(equipmentManuals, ({ one, many }) => ({
  company: one(companies, { fields: [equipmentManuals.companyId], references: [companies.id] }),
  equipment: one(equipmentAssets, { fields: [equipmentManuals.equipmentId], references: [equipmentAssets.id] }),
  createdBy: one(admins, { fields: [equipmentManuals.createdById], references: [admins.id] }),
  chunks: many(equipmentManualChunks),
}));

export const equipmentManualChunksRelations = relations(equipmentManualChunks, ({ one }) => ({
  manual: one(equipmentManuals, { fields: [equipmentManualChunks.manualId], references: [equipmentManuals.id] }),
  company: one(companies, { fields: [equipmentManualChunks.companyId], references: [companies.id] }),
  equipment: one(equipmentAssets, { fields: [equipmentManualChunks.equipmentId], references: [equipmentAssets.id] }),
}));

export const operationalLogsRelations = relations(operationalLogs, ({ one, many }) => ({
  company: one(companies, { fields: [operationalLogs.companyId], references: [companies.id] }),
  module: one(modules, { fields: [operationalLogs.moduleId], references: [modules.id] }),
  equipment: one(equipmentAssets, { fields: [operationalLogs.equipmentId], references: [equipmentAssets.id] }),
  createdBy: one(admins, { fields: [operationalLogs.createdById], references: [admins.id] }),
  assignedPlanner: one(admins, { fields: [operationalLogs.assignedPlannerId], references: [admins.id] }),
  attachments: many(logAttachments),
  timeline: many(logTimelineEvents),
}));

export const logAttachmentsRelations = relations(logAttachments, ({ one }) => ({
  log: one(operationalLogs, { fields: [logAttachments.logId], references: [operationalLogs.id] }),
}));

export const logTimelineEventsRelations = relations(logTimelineEvents, ({ one }) => ({
  log: one(operationalLogs, { fields: [logTimelineEvents.logId], references: [operationalLogs.id] }),
  actor: one(admins, { fields: [logTimelineEvents.actorId], references: [admins.id] }),
}));
