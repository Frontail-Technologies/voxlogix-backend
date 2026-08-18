import type { z } from "zod";

import type {
  meterCounterIdParamsSchema,
  meterCounterLookupQuerySchema,
  meterCounterReadingBodySchema,
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
