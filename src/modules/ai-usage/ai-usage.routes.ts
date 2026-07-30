import { Router } from "express";

import { validate } from "@/middlewares/validate.middleware";
import {
  getAiUsageCompanies,
  getAiUsageCompany,
  getAiUsageOverview,
} from "@/modules/ai-usage/ai-usage.controller";
import {
  usageCompaniesQuerySchema,
  usageCompanyParamsSchema,
  usageOverviewQuerySchema,
} from "@/modules/ai-usage/ai-usage.validation";

const aiUsageRouter = Router();

aiUsageRouter.get(
  "/overview",
  validate({ query: usageOverviewQuerySchema }),
  getAiUsageOverview,
);
aiUsageRouter.get(
  "/companies",
  validate({ query: usageCompaniesQuerySchema }),
  getAiUsageCompanies,
);
aiUsageRouter.get(
  "/companies/:companyId",
  validate({ params: usageCompanyParamsSchema, query: usageOverviewQuerySchema }),
  getAiUsageCompany,
);

export { aiUsageRouter };
