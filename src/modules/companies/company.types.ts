import type { z } from "zod";

import type {
  createCompanyBodySchema,
  listCompaniesQuerySchema,
  updateCompanyAccessBodySchema,
  updateCompanyBodySchema,
} from "./company.validation";

export type ListCompaniesInput = z.infer<typeof listCompaniesQuerySchema>;
export type CreateCompanyInput = z.infer<typeof createCompanyBodySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanyBodySchema>;
export type UpdateCompanyAccessInput = z.infer<
  typeof updateCompanyAccessBodySchema
>;
