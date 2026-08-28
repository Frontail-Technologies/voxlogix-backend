import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { getActivities } from "@/modules/activities/activity.controller";
import { listActivitiesQuerySchema } from "@/modules/activities/activity.validation";
import { USER_ROLES } from "@/shared/constants";

const activitiesRouter = Router();
// Platform-wide audit log across all companies — only used by the
// master-activities frontend feature. Was previously fully unauthenticated;
// see security audit.
activitiesRouter.use(requireAuth, requireRole(USER_ROLES.MASTER));

activitiesRouter.get("/", validate({ query: listActivitiesQuerySchema }), getActivities);

export { activitiesRouter };
