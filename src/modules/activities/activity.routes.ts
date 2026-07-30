import { Router } from "express";

import { validate } from "@/middlewares/validate.middleware";
import { getActivities } from "@/modules/activities/activity.controller";
import { listActivitiesQuerySchema } from "@/modules/activities/activity.validation";

const activitiesRouter = Router();

activitiesRouter.get("/", validate({ query: listActivitiesQuerySchema }), getActivities);

export { activitiesRouter };
