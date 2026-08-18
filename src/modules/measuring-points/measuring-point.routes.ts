import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";
import {
  getMeasuringPointLookup,
  getMeasuringPointReadings,
  postMeasuringPointReading,
} from "@/modules/measuring-points/measuring-point.controller";
import {
  measuringPointIdParamsSchema,
  measuringPointLookupQuerySchema,
  measuringPointReadingBodySchema,
} from "@/modules/measuring-points/measuring-point.validation";
import { USER_ROLES } from "@/shared/constants";
import { paginationQuerySchema } from "@/shared/validators/pagination.validation";

const measuringPointsRouter = Router();
const roles = [USER_ROLES.ADMIN, USER_ROLES.MASTER, USER_ROLES.PLANNER, USER_ROLES.EXECUTION];

measuringPointsRouter.use(requireAuth, requireRole(...roles));
measuringPointsRouter.get("/", validate({ query: measuringPointLookupQuerySchema }), getMeasuringPointLookup);
measuringPointsRouter.get(
  "/:pointId/readings",
  validate({ params: measuringPointIdParamsSchema, query: paginationQuerySchema }),
  getMeasuringPointReadings,
);
measuringPointsRouter.post(
  "/:pointId/readings",
  validate({ params: measuringPointIdParamsSchema, body: measuringPointReadingBodySchema }),
  postMeasuringPointReading,
);

export { measuringPointsRouter };
