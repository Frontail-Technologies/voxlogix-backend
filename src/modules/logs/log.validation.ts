import { z } from "zod";

import { paginationQuerySchema } from "@/shared/validators/pagination.validation";

export const listLogsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
  severity: z.string().trim().optional(),
  moduleType: z.string().trim().optional(),
  equipmentId: z.string().uuid().optional(),
  createdById: z.string().uuid().optional(),
  scope: z.enum(["feed", "mine"]).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const logIdParamsSchema = z.object({
  logId: z.string().uuid(),
});

export const logAttachmentIdParamsSchema = z.object({
  logId: z.string().uuid(),
  attachmentId: z.string().uuid(),
});

export const logBodySchema = z.object({
  clientRequestId: z.string().trim().min(1).max(120).optional(),
  moduleId: z.string().uuid().optional().nullable(),
  equipmentId: z.string().uuid().optional().nullable(),
  assignedPlannerId: z.string().uuid().optional().nullable(),
  moduleType: z.string().trim().min(1).max(80),
  title: z.string().trim().min(2).max(220),
  description: z.string().trim().max(5000).optional().nullable(),
  transcript: z.string().trim().max(10000).optional().nullable(),
  issueCategory: z.string().trim().max(160).optional().nullable(),
  severity: z.string().trim().min(1).max(40).default("MEDIUM"),
  status: z.string().trim().min(1).max(60).default("SUBMITTED"),
  aiProcessed: z.boolean().optional().default(false),
  voiceDurationSeconds: z.number().int().min(0).optional().default(0),
  voiceRecordingUrl: z.string().trim().url().max(2000).optional().nullable(),
  voiceRecordingKey: z.string().trim().max(2000).optional().nullable(),
  downtimeMinutes: z.number().int().min(0).optional().default(0),
  extractedFields: z.record(z.string(), z.unknown()).optional().default({}),
  capturedLatitude: z.number().min(-90).max(90).optional().nullable(),
  capturedLongitude: z.number().min(-180).max(180).optional().nullable(),
  capturedAddress: z.string().trim().max(1000).optional().nullable(),
});

export const updateLogBodySchema = logBodySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field is required" },
);

export const updateLogStatusBodySchema = z.object({
  status: z.string().trim().min(1).max(60),
  notes: z.string().trim().max(2000).optional(),
});

export const logAttachmentBodySchema = z.object({
  url: z.string().trim().url(),
  key: z.string().trim().max(500).optional().nullable(),
  fileName: z.string().trim().max(220).optional().nullable(),
  mimeType: z.string().trim().max(120).optional().nullable(),
  label: z.string().trim().max(120).optional().nullable(),
  sortOrder: z.number().int().positive().optional().default(1),
});
