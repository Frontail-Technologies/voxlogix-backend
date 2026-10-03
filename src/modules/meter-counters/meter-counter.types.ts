import type { z } from "zod";

import type {
  meterCounterIdParamsSchema,
  meterCounterReadingIdParamsSchema,
  meterCounterLookupQuerySchema,
  meterCounterReadingBodySchema,
  invalidateMeterCounterReadingBodySchema,
} from "@/modules/meter-counters/meter-counter.validation";

export type MeterCounterLookupInput = z.infer<typeof meterCounterLookupQuerySchema> & {
  companyId: string;
};

export type MeterCounterReadingInput = z.infer<typeof meterCounterReadingBodySchema> & {
  companyId: string;
  counterId: string;
  reportedById?: string;
  reportedByName?: string;
};

export type MeterCounterIdParams = z.infer<typeof meterCounterIdParamsSchema>;
export type MeterCounterReadingIdParams = z.infer<typeof meterCounterReadingIdParamsSchema>;

export type InvalidateMeterCounterReadingInput = z.infer<typeof invalidateMeterCounterReadingBodySchema> & {
  companyId: string;
  counterId: string;
  readingId: string;
  invalidatedByUserId: string;
  invalidatedByName: string;
};
