import { z } from "zod";

import { COMPANY_STATUS } from "@/shared/constants";
import { paginationQuerySchema } from "@/shared/validators/pagination.validation";

export const listCompaniesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  status: z.enum(Object.values(COMPANY_STATUS) as [string, ...string[]]).optional(),
});

export const companyIdParamsSchema = z.object({
  companyId: z.string().uuid(),
});
