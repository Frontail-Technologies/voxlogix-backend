import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { getMasterDataOptions } from "@/modules/master-data-options/master-data-option.controller";
import { masterDataOptionsParamsSchema, masterDataOptionsQuerySchema } from "@/modules/master-data-options/master-data-option.validation";
import { USER_ROLES } from "@/shared/constants";

const masterDataOptionsRouter = Router();
const roles = [USER_ROLES.ADMIN, USER_ROLES.MASTER, USER_ROLES.PLANNER, USER_ROLES.EXECUTION];

masterDataOptionsRouter.use(requireAuth, requireRole(...roles));
masterDataOptionsRouter.get(
  "/:sourceKey",
  validate({ params: masterDataOptionsParamsSchema, query: masterDataOptionsQuerySchema }),
  getMasterDataOptions,
);

export { masterDataOptionsRouter };
