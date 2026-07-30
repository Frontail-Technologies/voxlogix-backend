import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { USER_ROLES } from "@/shared/constants";

import { getNotifications } from "./notification.controller";

const notificationsRouter = Router();

notificationsRouter.get(
  "/",
  requireAuth,
  requireRole(USER_ROLES.EXECUTION, USER_ROLES.PLANNER, USER_ROLES.ADMIN, USER_ROLES.MASTER),
  getNotifications,
);

export { notificationsRouter };
