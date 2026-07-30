import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { moduleCategories, moduleFields, modules, moduleTypes } from "@/db/schema";
import { toSlug } from "@/shared/helpers/slug";

type DefaultField = {
  label: string;
  key: string;
  type: string;
  required?: boolean;
  aiExtract?: boolean;
  sourceType: "system" | "ai" | "master" | "manual" | "computed";
  sourceKey?:
    | "equipment_master"
    | "issue_categories"
    | "safety_reporting"
    | "measuring_points"
    | "meter_counters"
    | "users_roles"
    | "sections_locations_shift"
    | "kaizen"
    | null;
  feedVisible?: boolean;
  reportVisible?: boolean;
  sortOrder: number;
  options?: string[] | null;
  validationRules?: Record<string, unknown> | null;
};

type DefaultModule = {
  name: string;
  typeName: string;
  category: string;
  icon: string;
  color: string;
  description: string;
  promptPreview: string;
  voiceEnabled: boolean;
  feedEnabled: boolean;
  feedOnlyOnAlert: boolean;
  requiresVoicePlayback: boolean;
  maxAttachments: number;
  fields: DefaultField[];
};

const MODULE_TYPES = [
  { name: "Equipment Log", description: "Equipment events, issues, and maintenance observations." },
  { name: "Safety Log", description: "Safety observations, incidents, PPE, and action tracking." },
  { name: "Shift Log", description: "Shift handover notes, manpower, production, and blockers." },
  { name: "Kaizen", description: "Improvement suggestions and immediate actions." },
  { name: "Measurement Point", description: "Manual measurement readings and out-of-limit alerts." },
  { name: "Meter Counter", description: "Manual counter readings and deviation alerts." },
] as const;

const MODULE_CATEGORIES = [
  { name: "Operational", description: "Daily operations and equipment activity." },
  { name: "Safety", description: "Safety reporting and incident control." },
  { name: "Shift", description: "Shift handover and production context." },
  { name: "Improvement", description: "Kaizen and suggestion workflows." },
  { name: "Measurement", description: "Manual readings, counters, and alert-only feed events." },
] as const;

const DEFAULT_MODULES: DefaultModule[] = [
  {
    name: "Equipment Log",
    typeName: "Equipment Log",
    category: "Operational",
    icon: "equipment",
    color: "#f7b51e",
    description: "Capture equipment issues, conditions, actions, downtime, and maintenance follow-up.",
    promptPreview: '{\n  "equipment": "EQ-001 Air Compressor 1",\n  "issue_category": "Hydraulic Leak",\n  "severity": "High",\n  "action_taken": "Stopped operation and informed maintenance"\n}',
    voiceEnabled: true,
    feedEnabled: true,
    feedOnlyOnAlert: false,
    requiresVoicePlayback: true,
    maxAttachments: 5,
    fields: [
      { label: "Equipment", key: "equipment", type: "Select", required: true, aiExtract: true, sourceType: "master", sourceKey: "equipment_master", sortOrder: 1 },
      { label: "Issue Category", key: "issueCategory", type: "Select", required: true, aiExtract: true, sourceType: "master", sourceKey: "issue_categories", sortOrder: 2 },
      { label: "Issue Observed", key: "issueObserved", type: "Text", required: true, aiExtract: true, sourceType: "ai", sortOrder: 3 },
      { label: "Severity", key: "severity", type: "Select", required: true, aiExtract: true, sourceType: "master", sourceKey: "issue_categories", sortOrder: 4, options: ["Low", "Medium", "High", "Critical"] },
      { label: "Action Taken", key: "actionTaken", type: "Text", required: false, aiExtract: true, sourceType: "ai", sortOrder: 5 },
      { label: "Downtime Minutes", key: "downtimeMinutes", type: "Number", required: false, aiExtract: true, sourceType: "ai", sortOrder: 6, feedVisible: false, reportVisible: true },
      { label: "Assigned Planner", key: "assignedPlanner", type: "Select", required: false, aiExtract: true, sourceType: "master", sourceKey: "users_roles", sortOrder: 7, feedVisible: false, reportVisible: true },
    ],
  },
  {
    name: "Safety Log",
    typeName: "Safety Log",
    category: "Safety",
    icon: "warning",
    color: "#ef4444",
    description: "Capture safety observations, incident context, PPE needs, and immediate actions.",
    promptPreview: '{\n  "incident_category": "Unsafe Condition",\n  "incident_type": "Oil spill near walkway",\n  "severity": "High",\n  "immediate_action": "Barricaded area"\n}',
    voiceEnabled: true,
    feedEnabled: true,
    feedOnlyOnAlert: false,
    requiresVoicePlayback: true,
    maxAttachments: 5,
    fields: [
      { label: "Safety Category", key: "safetyCategory", type: "Select", required: true, aiExtract: true, sourceType: "master", sourceKey: "safety_reporting", sortOrder: 1 },
      { label: "Incident Type", key: "incidentType", type: "Select", required: true, aiExtract: true, sourceType: "master", sourceKey: "safety_reporting", sortOrder: 2 },
      { label: "Observation", key: "observation", type: "Text", required: true, aiExtract: true, sourceType: "ai", sortOrder: 3 },
      { label: "Severity", key: "severity", type: "Select", required: true, aiExtract: true, sourceType: "master", sourceKey: "safety_reporting", sortOrder: 4, options: ["Low", "Medium", "High", "Critical"] },
      { label: "PPE Required", key: "ppeRequired", type: "Select", required: false, aiExtract: true, sourceType: "master", sourceKey: "safety_reporting", sortOrder: 5, options: ["No", "Yes"] },
      { label: "Immediate Action", key: "immediateAction", type: "Text", required: false, aiExtract: true, sourceType: "ai", sortOrder: 6 },
      { label: "Reportable", key: "reportable", type: "Select", required: false, aiExtract: true, sourceType: "master", sourceKey: "safety_reporting", sortOrder: 7, options: ["No", "Yes"] },
    ],
  },
  {
    name: "Shift Log",
    typeName: "Shift Log",
    category: "Shift",
    icon: "calendar",
    color: "#64748b",
    description: "Capture shift handover, manpower, blockers, production notes, and next actions.",
    promptPreview: '{\n  "shift": "Night Shift",\n  "summary": "Production stable",\n  "blockers": "Packing line delayed",\n  "next_action": "Planner to inspect conveyor"\n}',
    voiceEnabled: true,
    feedEnabled: true,
    feedOnlyOnAlert: false,
    requiresVoicePlayback: true,
    maxAttachments: 3,
    fields: [
      { label: "Shift", key: "shift", type: "Select", required: true, aiExtract: true, sourceType: "master", sourceKey: "sections_locations_shift", sortOrder: 1 },
      { label: "Section", key: "section", type: "Select", required: false, aiExtract: true, sourceType: "master", sourceKey: "sections_locations_shift", sortOrder: 2 },
      { label: "Summary", key: "summary", type: "Text", required: true, aiExtract: true, sourceType: "ai", sortOrder: 3 },
      { label: "Manpower", key: "manpower", type: "Number", required: false, aiExtract: true, sourceType: "ai", sortOrder: 4, feedVisible: false, reportVisible: true },
      { label: "Production Notes", key: "productionNotes", type: "Text", required: false, aiExtract: true, sourceType: "ai", sortOrder: 5 },
      { label: "Blockers", key: "blockers", type: "Text", required: false, aiExtract: true, sourceType: "ai", sortOrder: 6 },
      { label: "Next Action", key: "nextAction", type: "Text", required: false, aiExtract: true, sourceType: "ai", sortOrder: 7 },
    ],
  },
  {
    name: "Kaizen",
    typeName: "Kaizen",
    category: "Improvement",
    icon: "ai",
    color: "#f97316",
    description: "Capture improvement ideas, departments, benefits, and action ownership.",
    promptPreview: '{\n  "category": "Process Improvement",\n  "suggestion": "Add shadow board near tool area",\n  "department": "Maintenance",\n  "benefit": "Reduce tool search time"\n}',
    voiceEnabled: true,
    feedEnabled: true,
    feedOnlyOnAlert: false,
    requiresVoicePlayback: true,
    maxAttachments: 5,
    fields: [
      { label: "Kaizen Category", key: "kaizenCategory", type: "Select", required: true, aiExtract: true, sourceType: "master", sourceKey: "kaizen", sortOrder: 1 },
      { label: "Department", key: "department", type: "Select", required: false, aiExtract: true, sourceType: "master", sourceKey: "kaizen", sortOrder: 2 },
      { label: "Suggestion", key: "suggestion", type: "Text", required: true, aiExtract: true, sourceType: "ai", sortOrder: 3 },
      { label: "Expected Benefit", key: "expectedBenefit", type: "Text", required: false, aiExtract: true, sourceType: "ai", sortOrder: 4 },
      { label: "Immediate Action Required", key: "immediateActionRequired", type: "Select", required: false, aiExtract: true, sourceType: "master", sourceKey: "kaizen", sortOrder: 5, options: ["No", "Yes"] },
      { label: "Owner", key: "owner", type: "Select", required: false, aiExtract: true, sourceType: "master", sourceKey: "users_roles", sortOrder: 6, feedVisible: false, reportVisible: true },
    ],
  },
  {
    name: "Measurement Point",
    typeName: "Measurement Point",
    category: "Measurement",
    icon: "status",
    color: "#3b82f6",
    description: "Manual measurement entry. Feed posts are created only when readings are outside limits.",
    promptPreview: '{\n  "measuring_point": "MP-001 Bearing Temperature",\n  "reading_value": 82,\n  "is_out_of_limit": true\n}',
    voiceEnabled: false,
    feedEnabled: false,
    feedOnlyOnAlert: true,
    requiresVoicePlayback: false,
    maxAttachments: 2,
    fields: [
      { label: "Measuring Point", key: "measuringPoint", type: "Select", required: true, aiExtract: false, sourceType: "master", sourceKey: "measuring_points", sortOrder: 1 },
      { label: "Reading Value", key: "readingValue", type: "Number", required: true, aiExtract: false, sourceType: "manual", sourceKey: null, sortOrder: 2 },
      { label: "Unit", key: "unit", type: "Text", required: false, aiExtract: false, sourceType: "master", sourceKey: "measuring_points", sortOrder: 3, feedVisible: false, reportVisible: true },
      { label: "Lower Limit", key: "lowerLimit", type: "Number", required: false, aiExtract: false, sourceType: "master", sourceKey: "measuring_points", sortOrder: 4, feedVisible: false, reportVisible: true },
      { label: "Upper Limit", key: "upperLimit", type: "Number", required: false, aiExtract: false, sourceType: "master", sourceKey: "measuring_points", sortOrder: 5, feedVisible: false, reportVisible: true },
      { label: "Out Of Limit", key: "isOutOfLimit", type: "Select", required: false, aiExtract: false, sourceType: "computed", sourceKey: null, sortOrder: 6, feedVisible: true, reportVisible: true, options: ["No", "Yes"] },
    ],
  },
  {
    name: "Meter Counter",
    typeName: "Meter Counter",
    category: "Measurement",
    icon: "database",
    color: "#2563eb",
    description: "Manual counter reading entry. Feed posts are created only when deviation exceeds configured limits.",
    promptPreview: '{\n  "meter_counter": "MC-001 Compressor Runtime",\n  "current_reading": 15200,\n  "is_out_of_limit": false\n}',
    voiceEnabled: false,
    feedEnabled: false,
    feedOnlyOnAlert: true,
    requiresVoicePlayback: false,
    maxAttachments: 2,
    fields: [
      { label: "Meter Counter", key: "meterCounter", type: "Select", required: true, aiExtract: false, sourceType: "master", sourceKey: "meter_counters", sortOrder: 1 },
      { label: "Current Reading", key: "currentReading", type: "Number", required: true, aiExtract: false, sourceType: "manual", sourceKey: null, sortOrder: 2 },
      { label: "Previous Reading", key: "previousReading", type: "Number", required: false, aiExtract: false, sourceType: "computed", sourceKey: null, sortOrder: 3, feedVisible: false, reportVisible: true },
      { label: "Consumption", key: "consumption", type: "Number", required: false, aiExtract: false, sourceType: "computed", sourceKey: null, sortOrder: 4, feedVisible: false, reportVisible: true },
      { label: "Deviation Percent", key: "deviationPercent", type: "Number", required: false, aiExtract: false, sourceType: "computed", sourceKey: null, sortOrder: 5, feedVisible: true, reportVisible: true },
      { label: "Out Of Limit", key: "isOutOfLimit", type: "Select", required: false, aiExtract: false, sourceType: "computed", sourceKey: null, sortOrder: 6, feedVisible: true, reportVisible: true, options: ["No", "Yes"] },
    ],
  },
];

async function ensureModuleType(name: string, description: string) {
  const slug = toSlug(name);
  const [existing] = await db.select({ id: moduleTypes.id }).from(moduleTypes).where(eq(moduleTypes.slug, slug)).limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(moduleTypes)
    .values({ name, slug, description, status: "ACTIVE", updatedAt: new Date() })
    .returning({ id: moduleTypes.id });

  return created.id;
}

async function ensureModuleCategory(name: string, description: string) {
  const slug = toSlug(name);
  const [existing] = await db.select({ id: moduleCategories.id }).from(moduleCategories).where(eq(moduleCategories.slug, slug)).limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(moduleCategories)
    .values({ name, slug, description, status: "ACTIVE", updatedAt: new Date() })
    .returning({ id: moduleCategories.id });

  return created.id;
}

async function ensureModuleField(moduleId: string, field: DefaultField) {
  const [existing] = await db
    .select({ id: moduleFields.id })
    .from(moduleFields)
    .where(and(eq(moduleFields.moduleId, moduleId), eq(moduleFields.key, field.key)))
    .limit(1);

  const values = {
    label: field.label,
    key: field.key,
    type: field.type,
    required: field.required ?? false,
    aiExtract: field.aiExtract ?? true,
    sourceType: field.sourceType,
    sourceKey: field.sourceKey ?? null,
    feedVisible: field.feedVisible ?? true,
    reportVisible: field.reportVisible ?? true,
    validationRules: field.validationRules ?? null,
    sortOrder: field.sortOrder,
    options: field.options ?? null,
    updatedAt: new Date(),
  } satisfies Partial<typeof moduleFields.$inferInsert>;

  if (existing) {
    await db.update(moduleFields).set(values).where(eq(moduleFields.id, existing.id));
    return;
  }

  await db.insert(moduleFields).values({ moduleId, ...values });
}

async function syncFieldsCount(moduleId: string, fieldsCount: number) {
  await db.update(modules).set({ fieldsCount, updatedAt: new Date() }).where(eq(modules.id, moduleId));
}

export async function ensureDefaultModuleSchemas() {
  for (const type of MODULE_TYPES) {
    await ensureModuleType(type.name, type.description);
  }

  for (const category of MODULE_CATEGORIES) {
    await ensureModuleCategory(category.name, category.description);
  }

  for (const moduleDefinition of DEFAULT_MODULES) {
    const moduleTypeId = await ensureModuleType(
      moduleDefinition.typeName,
      MODULE_TYPES.find((type) => type.name === moduleDefinition.typeName)?.description ?? moduleDefinition.description,
    );
    const slug = toSlug(moduleDefinition.name);
    const [existing] = await db.select({ id: modules.id }).from(modules).where(eq(modules.slug, slug)).limit(1);

    const moduleValues = {
      name: moduleDefinition.name,
      slug,
      moduleTypeId,
      category: moduleDefinition.category,
      status: "ACTIVE" as const,
      availabilityText: "Available to all companies",
      icon: moduleDefinition.icon,
      color: moduleDefinition.color,
      description: moduleDefinition.description,
      promptPreview: moduleDefinition.promptPreview,
      voiceEnabled: moduleDefinition.voiceEnabled,
      feedEnabled: moduleDefinition.feedEnabled,
      feedOnlyOnAlert: moduleDefinition.feedOnlyOnAlert,
      requiresVoicePlayback: moduleDefinition.requiresVoicePlayback,
      maxAttachments: moduleDefinition.maxAttachments,
      fieldsCount: moduleDefinition.fields.length,
      updatedAt: new Date(),
    } satisfies Partial<typeof modules.$inferInsert>;

    const moduleId = existing
      ? existing.id
      : (
          await db.insert(modules).values(moduleValues as typeof modules.$inferInsert).returning({ id: modules.id })
        )[0].id;

    if (existing) {
      await db.update(modules).set(moduleValues).where(eq(modules.id, moduleId));
    }

    for (const field of moduleDefinition.fields) {
      await ensureModuleField(moduleId, field);
    }

    await syncFieldsCount(moduleId, moduleDefinition.fields.length);
  }
}
