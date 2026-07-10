import { Router } from "express";

import { validate } from "@/middlewares/validate.middleware";

import {
  getAdmin,
  getAdmins,
  patchAdmin,
  postAdmin,
  postAdminPasswordReset,
  removeAdmin,
} from "./admin.controller";
import {
  adminIdParamsSchema,
  createAdminBodySchema,
  listAdminsQuerySchema,
  resetAdminPasswordBodySchema,
  updateAdminBodySchema,
} from "./admin.validation";

const adminsRouter = Router();

adminsRouter.get("/", validate({ query: listAdminsQuerySchema }), getAdmins);
adminsRouter.get("/:adminId", validate({ params: adminIdParamsSchema }), getAdmin);
adminsRouter.post("/", validate({ body: createAdminBodySchema }), postAdmin);
adminsRouter.patch(
  "/:adminId",
  validate({ params: adminIdParamsSchema, body: updateAdminBodySchema }),
  patchAdmin,
);
adminsRouter.post(
  "/:adminId/reset-password",
  validate({
    params: adminIdParamsSchema,
    body: resetAdminPasswordBodySchema,
  }),
  postAdminPasswordReset,
);
adminsRouter.delete(
  "/:adminId",
  validate({ params: adminIdParamsSchema }),
  removeAdmin,
);

export { adminsRouter };
