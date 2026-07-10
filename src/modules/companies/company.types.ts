import type { z } from "zod";

import type { listCompaniesQuerySchema } from "./company.validation";

export type ListCompaniesInput = z.infer<typeof listCompaniesQuerySchema>;
