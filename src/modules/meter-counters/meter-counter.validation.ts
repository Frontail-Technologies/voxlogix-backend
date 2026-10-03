import { z } from "zod";

import { paginationQuerySchema } from "@/shared/validators/pagination.validation";

export const meterCounterLookupQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  counterCode: z.string().trim().optional(),
});

export const meterCounterIdParamsSchema = z.object({
  counterId: z.string().uuid(),
});

export const meterCounterReadingIdParamsSchema = meterCounterIdParamsSchema.extend({
  readingId: z.string().uuid(),
});

export const meterCounterReadingBodySchema = z.object({
  currentReading: z.number().finite(),
});

export const invalidateMeterCounterReadingBodySchema = z.object({
  reason: z.string().trim().min(1, "Reason is required.").max(500, "Reason must be 500 characters or fewer."),
});
