import type { z } from "zod";

import type {
  invalidateMeasuringPointReadingBodySchema,
  measuringPointIdParamsSchema,
  measuringPointReadingIdParamsSchema,
  measuringPointLookupQuerySchema,
  measuringPointReadingBodySchema,
} from "@/modules/measuring-points/measuring-point.validation";

export type MeasuringPointLookupInput = z.infer<typeof measuringPointLookupQuerySchema> & {
  companyId: string;
};

export type MeasuringPointReadingInput = z.infer<typeof measuringPointReadingBodySchema> & {
  companyId: string;
  pointId: string;
  reportedById?: string;
  reportedByName?: string;
};

export type MeasuringPointIdParams = z.infer<typeof measuringPointIdParamsSchema>;
export type MeasuringPointReadingIdParams = z.infer<typeof measuringPointReadingIdParamsSchema>;

export type InvalidateMeasuringPointReadingInput = z.infer<typeof invalidateMeasuringPointReadingBodySchema> & {
  companyId: string;
  pointId: string;
  readingId: string;
  invalidatedByUserId: string;
  invalidatedByName: string;
};
