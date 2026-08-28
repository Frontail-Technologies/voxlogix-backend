import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
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
import { USER_ROLES } from "@/shared/constants";

const aiUsageRouter = Router();
// Cross-company AI usage/billing data — platform-wide, MASTER only. Was
// previously fully unauthenticated; see security audit.
aiUsageRouter.use(requireAuth, requireRole(USER_ROLES.MASTER));

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
