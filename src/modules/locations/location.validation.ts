import { z } from "zod";

import { paginationQuerySchema } from "@/shared/validators/pagination.validation";

export const listLocationsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
});

export const locationIdParamsSchema = z.object({ locationId: z.string().uuid() });

export const locationBodySchema = z.object({
  plant: z.string().trim().min(1).max(160),
  unit: z.string().trim().max(160).optional().nullable(),
  shiftDetails: z.string().trim().max(160).optional().nullable(),
  department: z.string().trim().max(160).optional().nullable(),
  section: z.string().trim().min(1).max(160),
  subLocation: z.string().trim().min(1).max(160),
  status: z.string().trim().min(1).max(40).default("ACTIVE"),
});

export const updateLocationBodySchema = locationBodySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field is required" },
);

