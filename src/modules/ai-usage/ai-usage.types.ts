import type { z } from "zod";

import type {
  usageCompaniesQuerySchema,
  usageCompanyParamsSchema,
  usageOverviewQuerySchema,
} from "./ai-usage.validation";

export type UsageOverviewInput = z.infer<typeof usageOverviewQuerySchema>;
export type UsageCompaniesInput = z.infer<typeof usageCompaniesQuerySchema>;
export type UsageCompanyParams = z.infer<typeof usageCompanyParamsSchema>;
