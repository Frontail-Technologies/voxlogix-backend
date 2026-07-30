import { z } from "zod";

import { paginationQuerySchema } from "@/shared/validators/pagination.validation";

export const listEquipmentManualsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  equipmentId: z.string().uuid().optional(),
  status: z.string().trim().optional(),
});

export const equipmentManualIdParamsSchema = z.object({
  manualId: z.string().uuid(),
});

export const equipmentManualBodySchema = z.object({
  equipmentId: z.string().uuid(),
  title: z.string().trim().min(2).max(220),
  manualUrl: z.string().trim().url().optional().nullable(),
  manualText: z.string().trim().max(200000).optional().nullable(),
  status: z.string().trim().min(1).max(40).optional(),
});

export const updateEquipmentManualBodySchema = equipmentManualBodySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field is required" },
);
