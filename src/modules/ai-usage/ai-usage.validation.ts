import { z } from "zod";

import { paginationQuerySchema } from "@/shared/validators/pagination.validation";

const monthYearQuerySchema = z.object({
  period: z.enum(["THIS_MONTH", "LAST_MONTH", "THIS_QUARTER"]).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
});

export const usageOverviewQuerySchema = monthYearQuerySchema;

export const usageCompaniesQuerySchema = paginationQuerySchema.merge(monthYearQuerySchema).extend({
  companyId: z.string().uuid().optional(),
});

export const usageCompanyParamsSchema = z.object({
  companyId: z.string().uuid(),
});
