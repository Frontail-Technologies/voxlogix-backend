import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { USER_ROLES } from "@/shared/constants";

import { getDashboardSummary, getExecutionSummary } from "./dashboard.controller";

const dashboardRouter = Router();

dashboardRouter.get(
  "/summary",
  requireAuth,
  requireRole(USER_ROLES.ADMIN),
  getDashboardSummary,
);

dashboardRouter.get(
  "/execution-summary",
  requireAuth,
  requireRole(USER_ROLES.EXECUTION, USER_ROLES.PLANNER, USER_ROLES.ADMIN, USER_ROLES.MASTER),
  getExecutionSummary,
);

export { dashboardRouter };
