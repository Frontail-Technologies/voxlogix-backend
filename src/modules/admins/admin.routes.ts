import { Router } from "express";

import { parseMultipartPayload } from "@/middlewares/multipart-payload.middleware";
import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { singleImageUploadMiddleware } from "@/modules/uploads/uploads.middleware";
import { USER_ROLES } from "@/shared/constants";

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
adminsRouter.use(requireAuth, requireRole(USER_ROLES.MASTER, USER_ROLES.ADMIN));

adminsRouter.get("/", validate({ query: listAdminsQuerySchema }), getAdmins);
adminsRouter.get(
  "/:adminId",
  validate({ params: adminIdParamsSchema }),
  getAdmin,
);
adminsRouter.post(
  "/",
  singleImageUploadMiddleware,
  parseMultipartPayload,
  validate({ body: createAdminBodySchema }),
  postAdmin,
);
adminsRouter.patch(
  "/:adminId",
  singleImageUploadMiddleware,
  parseMultipartPayload,
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
