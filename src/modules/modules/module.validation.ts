import { z } from "zod";

import { MODULE_STATUS } from "@/shared/constants";
import { paginationQuerySchema } from "@/shared/validators/pagination.validation";

const moduleStatusValues = Object.values(MODULE_STATUS) as [string, ...string[]];
const fieldTypeValues = ["Text", "Number", "Select", "Date"] as const;
const fieldSourceTypeValues = ["system", "ai", "master", "manual", "computed"] as const;
const fieldSourceKeyValues = [
  "equipment_master",
  "issue_categories",
  "safety_reporting",
  "measuring_points",
  "meter_counters",
  "users_roles",
  "sections_locations_shift",
  "kaizen",
] as const;

export const listModulesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  status: z.enum(moduleStatusValues).optional(),
  moduleTypeId: z.string().uuid().optional(),
});

export const moduleIdParamsSchema = z.object({
  moduleId: z.string().uuid(),
});

export const fieldIdParamsSchema = z.object({
  moduleId: z.string().uuid(),
  fieldId: z.string().uuid(),
});

export const moduleFieldSchema = z.object({
  label: z.string().trim().min(1).max(160),
  key: z.string().trim().min(1).max(160).optional(),
  type: z.enum(fieldTypeValues),
  required: z.boolean().default(false),
  aiExtract: z.boolean().default(true),
  sourceType: z.enum(fieldSourceTypeValues).default("ai"),
  sourceKey: z.enum(fieldSourceKeyValues).nullable().optional(),
  feedVisible: z.boolean().default(true),
  reportVisible: z.boolean().default(true),
  validationRules: z.record(z.string(), z.unknown()).nullable().optional(),
  sortOrder: z.number().int().positive(),
  options: z.array(z.string().trim().min(1)).optional(),
});

export const createModuleBodySchema = z.object({
  name: z.string().trim().min(2).max(160),
  moduleTypeId: z.string().uuid(),
  category: z.string().trim().min(2).max(80).default("Operational"),
  status: z.enum(moduleStatusValues),
  availabilityText: z.string().trim().min(2).max(120),
  icon: z.string().trim().min(2).max(80),
  color: z
    .string()
    .trim()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
  description: z.string().trim().max(2000).optional(),
  mediaUrl: z.string().trim().url().max(2000).nullable().optional(),
  mediaKey: z.string().trim().max(2000).nullable().optional(),
  promptPreview: z.string().trim().max(10000).optional(),
  voiceEnabled: z.boolean().default(true),
  feedEnabled: z.boolean().default(true),
  feedOnlyOnAlert: z.boolean().default(false),
  requiresVoicePlayback: z.boolean().default(true),
  maxAttachments: z.number().int().min(0).max(20).default(5),
  fields: z.array(moduleFieldSchema).optional().default([]),
});

export const updateModuleBodySchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    moduleTypeId: z.string().uuid().optional(),
    category: z.string().trim().min(2).max(80).optional(),
    status: z.enum(moduleStatusValues).optional(),
    availabilityText: z.string().trim().min(2).max(120).optional(),
    icon: z.string().trim().min(2).max(80).optional(),
    color: z
      .string()
      .trim()
      .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .optional(),
    description: z.string().trim().max(2000).optional(),
  mediaUrl: z.string().trim().url().max(2000).nullable().optional(),
    mediaKey: z.string().trim().max(2000).nullable().optional(),
    promptPreview: z.string().trim().max(10000).optional(),
    voiceEnabled: z.boolean().optional(),
    feedEnabled: z.boolean().optional(),
    feedOnlyOnAlert: z.boolean().optional(),
    requiresVoicePlayback: z.boolean().optional(),
    maxAttachments: z.number().int().min(0).max(20).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const createModuleFieldBodySchema = moduleFieldSchema;

export const updateModuleFieldBodySchema = z
  .object({
    label: z.string().trim().min(1).max(160).optional(),
    key: z.string().trim().min(1).max(160).optional(),
    type: z.enum(fieldTypeValues).optional(),
    required: z.boolean().optional(),
    aiExtract: z.boolean().optional(),
    sourceType: z.enum(fieldSourceTypeValues).optional(),
    sourceKey: z.enum(fieldSourceKeyValues).nullable().optional(),
    feedVisible: z.boolean().optional(),
    reportVisible: z.boolean().optional(),
    validationRules: z.record(z.string(), z.unknown()).nullable().optional(),
    sortOrder: z.number().int().positive().optional(),
    options: z.array(z.string().trim().min(1)).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });
