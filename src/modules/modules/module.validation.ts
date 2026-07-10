import { z } from "zod";

import { MODULE_STATUS, MODULE_TYPES } from "@/shared/constants";
import { paginationQuerySchema } from "@/shared/validators/pagination.validation";

const moduleTypeValues = Object.values(MODULE_TYPES) as [string, ...string[]];
const moduleStatusValues = Object.values(MODULE_STATUS) as [string, ...string[]];
const fieldTypeValues = ["Text", "Number", "Select", "Date"] as const;

export const listModulesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  status: z.enum(moduleStatusValues).optional(),
  type: z.enum(moduleTypeValues).optional(),
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
  key: z.string().trim().min(1).max(160),
  type: z.enum(fieldTypeValues),
  required: z.boolean().default(false),
  aiExtract: z.boolean().default(true),
  sortOrder: z.number().int().positive(),
  options: z.array(z.string().trim().min(1)).optional(),
});

export const createModuleBodySchema = z.object({
  name: z.string().trim().min(2).max(160),
  type: z.enum(moduleTypeValues),
  category: z.string().trim().min(2).max(80).default("Operational"),
  status: z.enum(moduleStatusValues),
  availabilityText: z.string().trim().min(2).max(120),
  icon: z.string().trim().min(2).max(80),
  color: z
    .string()
    .trim()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
  description: z.string().trim().max(2000).optional(),
  promptPreview: z.string().trim().max(10000).optional(),
  fields: z.array(moduleFieldSchema).optional().default([]),
});

export const updateModuleBodySchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    type: z.enum(moduleTypeValues).optional(),
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
    promptPreview: z.string().trim().max(10000).optional(),
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
    sortOrder: z.number().int().positive().optional(),
    options: z.array(z.string().trim().min(1)).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });
