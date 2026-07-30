import { z } from "zod";

import { paginationQuerySchema } from "@/shared/validators/pagination.validation";

export const listActivitiesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  area: z.string().trim().optional(),
  action: z.string().trim().optional(),
  status: z.string().trim().optional(),
});
