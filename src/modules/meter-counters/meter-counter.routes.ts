import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";
import {
  getMeterCounterLookup,
  getMeterCounterReadings,
  postMeterCounterReading,
} from "@/modules/meter-counters/meter-counter.controller";
import {
  meterCounterIdParamsSchema,
  meterCounterLookupQuerySchema,
  meterCounterReadingBodySchema,
} from "@/modules/meter-counters/meter-counter.validation";
import { USER_ROLES } from "@/shared/constants";
import { paginationQuerySchema } from "@/shared/validators/pagination.validation";

const meterCountersRouter = Router();
const roles = [USER_ROLES.ADMIN, USER_ROLES.MASTER, USER_ROLES.PLANNER, USER_ROLES.EXECUTION];

meterCountersRouter.use(requireAuth, requireRole(...roles));
meterCountersRouter.get("/", validate({ query: meterCounterLookupQuerySchema }), getMeterCounterLookup);
meterCountersRouter.get(
  "/:counterId/readings",
  validate({ params: meterCounterIdParamsSchema, query: paginationQuerySchema }),
  getMeterCounterReadings,
);
meterCountersRouter.post(
  "/:counterId/readings",
  validate({ params: meterCounterIdParamsSchema, body: meterCounterReadingBodySchema }),
  postMeterCounterReading,
);

export { meterCountersRouter };
