import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";
import {
  downloadOutputReportController,
  getKpiDashboardController,
  getOutputReportSummaryController,
} from "@/modules/reports/report.controller";
import { outputReportQuerySchema } from "@/modules/reports/report.validation";
import { USER_ROLES } from "@/shared/constants";

const reportsRouter = Router();
const reportRoles = [USER_ROLES.ADMIN, USER_ROLES.MASTER];

reportsRouter.use(requireAuth, requireRole(...reportRoles));
reportsRouter.get("/kpi-dashboard", validate({ query: outputReportQuerySchema }), getKpiDashboardController);
reportsRouter.get("/output/summary", validate({ query: outputReportQuerySchema }), getOutputReportSummaryController);
reportsRouter.get("/output/export", validate({ query: outputReportQuerySchema }), downloadOutputReportController);

export { reportsRouter };
