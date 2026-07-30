import { z } from "zod";

import { paginationQuerySchema } from "@/shared/validators/pagination.validation";

export const listEquipmentQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
  criticality: z.string().trim().optional(),
  section: z.string().trim().optional(),
});

export const equipmentIdParamsSchema = z.object({
  equipmentId: z.string().uuid(),
});

export const equipmentBodySchema = z.object({
  locationId: z.string().uuid().optional().nullable(),
  equipmentCode: z.string().trim().min(1).max(80),
  name: z.string().trim().min(2).max(160),
  category: z.string().trim().min(1).max(120).default("Equipment"),
  section: z.string().trim().min(1).max(160),
  subLocation: z.string().trim().min(1).max(160),
  makeBrand: z.string().trim().max(160).optional().nullable(),
  modelNumber: z.string().trim().max(160).optional().nullable(),
  criticality: z.string().trim().min(1).max(40).default("MEDIUM"),
  status: z.string().trim().min(1).max(60).default("ACTIVE"),
  imageUrl: z.string().trim().url().optional().nullable(),
  latitude: z.string().trim().optional().nullable(),
  longitude: z.string().trim().optional().nullable(),
  mapUrl: z.string().trim().url().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  manualUrl: z.string().trim().url().optional().nullable(),
  manualText: z.string().trim().max(20000).optional().nullable(),
  commissionedAt: z.coerce.date().optional().nullable(),
});

export const updateEquipmentBodySchema = equipmentBodySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field is required" },
);
