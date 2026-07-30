import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { USER_ROLES } from "@/shared/constants";

import { getLocationDetail, getLocations, patchLocation, postLocation, removeLocation } from "./location.controller";
import { listLocationsQuerySchema, locationBodySchema, locationIdParamsSchema, updateLocationBodySchema } from "./location.validation";

const locationsRouter = Router();
locationsRouter.use(requireAuth, requireRole(USER_ROLES.ADMIN, USER_ROLES.MASTER));
locationsRouter.get("/", validate({ query: listLocationsQuerySchema }), getLocations);
locationsRouter.get("/:locationId", validate({ params: locationIdParamsSchema }), getLocationDetail);
locationsRouter.post("/", validate({ body: locationBodySchema }), postLocation);
locationsRouter.patch("/:locationId", validate({ params: locationIdParamsSchema, body: updateLocationBodySchema }), patchLocation);
locationsRouter.delete("/:locationId", validate({ params: locationIdParamsSchema }), removeLocation);

export { locationsRouter };
