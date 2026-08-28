import { z } from "zod";

export const listImportedMasterDataQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
});

export const importedMasterDataIdParamsSchema = z.object({ id: z.string().uuid() });

// Editing status back to ACTIVE is how a deactivated ("deleted") record is
// reactivated — there's no separate reactivate endpoint.
const recordStatusField = z.enum(["ACTIVE", "INACTIVE"]).optional();

export const safetyReportingBodySchema = z.object({
  status: recordStatusField,
  safetyCategoryCode: z.string().trim().max(80).optional(),
  incidentCategory: z.string().trim().min(1).max(160).optional(),
  incidentType: z.string().trim().min(1).max(180).optional(),
  severityLevel: z.string().trim().min(1).max(40).optional(),
  requiresPpe: z.string().trim().min(1).max(12).optional(),
  ppeType: z.string().trim().max(160).optional(),
  reportable: z.string().trim().min(1).max(12).optional(),
  immediateActionRequired: z.string().trim().min(1).max(12).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export const updateSafetyReportingBodySchema = safetyReportingBodySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const measuringPointBodySchema = z.object({
  status: recordStatusField,
  pointCode: z.string().trim().min(1).max(80).optional(),
  measurementName: z.string().trim().min(1).max(180).optional(),
  measurementUnit: z.string().trim().min(1).max(40).optional(),
  targetValue: z.coerce.number().finite().optional().nullable(),
  lowerLimit: z.coerce.number().finite().optional().nullable(),
  upperLimit: z.coerce.number().finite().optional().nullable(),
  measurementFrequency: z.string().trim().max(120).optional(),
  alertSeverity: z.string().trim().min(1).max(40).optional(),
  instrumentTag: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export const updateMeasuringPointBodySchema = measuringPointBodySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const meterCounterBodySchema = z.object({
  status: recordStatusField,
  counterCode: z.string().trim().min(1).max(80).optional(),
  location: z.string().trim().max(160).optional(),
  counterName: z.string().trim().min(1).max(180).optional(),
  counterUnit: z.string().trim().min(1).max(40).optional(),
  meterType: z.string().trim().min(1).max(100).optional(),
  readingFrequency: z.string().trim().max(120).optional(),
  initialReading: z.coerce.number().finite().optional().nullable(),
  resetValue: z.coerce.number().finite().optional().nullable(),
  expectedDailyConsumption: z.coerce.number().finite().optional().nullable(),
  alertDeviationPct: z.coerce.number().finite().optional().nullable(),
  notes: z.string().trim().max(2000).optional(),
});
export const updateMeterCounterBodySchema = meterCounterBodySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const kaizenCategoryBodySchema = z.object({
  status: recordStatusField,
  kaizenCategoryCode: z.string().trim().max(80).optional(),
  category: z.string().trim().min(1).max(180).optional(),
  department: z.string().trim().max(160).optional(),
  kaizenStatus: z.string().trim().max(80).optional(),
  immediateActionRequired: z.string().trim().max(12).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export const updateKaizenCategoryBodySchema = kaizenCategoryBodySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });
