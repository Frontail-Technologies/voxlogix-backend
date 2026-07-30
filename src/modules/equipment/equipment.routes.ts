import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { parseMultipartPayload } from "@/middlewares/multipart-payload.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { singleImageUploadMiddleware } from "@/modules/uploads/uploads.middleware";
import { USER_ROLES } from "@/shared/constants";

import {
  getEquipmentDetail,
  getEquipmentList,
  patchEquipment,
  postEquipment,
  removeEquipment,
} from "./equipment.controller";
import {
  equipmentBodySchema,
  equipmentIdParamsSchema,
  listEquipmentQuerySchema,
  updateEquipmentBodySchema,
} from "./equipment.validation";

const equipmentRouter = Router();
const adminRoles = [USER_ROLES.ADMIN, USER_ROLES.MASTER, USER_ROLES.PLANNER, USER_ROLES.EXECUTION];

equipmentRouter.use(requireAuth, requireRole(...adminRoles));
equipmentRouter.get("/", validate({ query: listEquipmentQuerySchema }), getEquipmentList);
equipmentRouter.get("/:equipmentId", validate({ params: equipmentIdParamsSchema }), getEquipmentDetail);
equipmentRouter.post(
  "/",
  singleImageUploadMiddleware,
  parseMultipartPayload,
  validate({ body: equipmentBodySchema }),
  postEquipment,
);
equipmentRouter.patch(
  "/:equipmentId",
  singleImageUploadMiddleware,
  parseMultipartPayload,
  validate({ params: equipmentIdParamsSchema, body: updateEquipmentBodySchema }),
  patchEquipment,
);
equipmentRouter.delete("/:equipmentId", validate({ params: equipmentIdParamsSchema }), removeEquipment);

export { equipmentRouter };
