import { z } from "zod";

import { paginationQuerySchema } from "@/shared/validators/pagination.validation";

export const measuringPointLookupQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  pointCode: z.string().trim().optional(),
});

export const measuringPointIdParamsSchema = z.object({
  pointId: z.string().uuid(),
});

export const measuringPointReadingIdParamsSchema = measuringPointIdParamsSchema.extend({
  readingId: z.string().uuid(),
});

export const measuringPointReadingBodySchema = z.object({
  measuredValue: z.number().finite(),
});

export const invalidateMeasuringPointReadingBodySchema = z.object({
  reason: z.string().trim().min(1, "Reason is required.").max(500, "Reason must be 500 characters or fewer."),
});
