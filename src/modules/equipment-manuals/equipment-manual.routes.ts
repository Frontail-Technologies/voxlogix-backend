import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { parseMultipartPayload } from "@/middlewares/multipart-payload.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { singleDocumentUploadMiddleware } from "@/modules/uploads/uploads.middleware";
import { USER_ROLES } from "@/shared/constants";

import {
  getEquipmentManualDetail,
  getEquipmentManualsList,
  patchEquipmentManual,
  postEquipmentManual,
  removeEquipmentManual,
} from "./equipment-manual.controller";
import {
  equipmentManualBodySchema,
  equipmentManualIdParamsSchema,
  listEquipmentManualsQuerySchema,
  updateEquipmentManualBodySchema,
} from "./equipment-manual.validation";

const equipmentManualsRouter = Router();
const adminRoles = [USER_ROLES.ADMIN, USER_ROLES.MASTER, USER_ROLES.PLANNER];

equipmentManualsRouter.use(requireAuth, requireRole(...adminRoles));
equipmentManualsRouter.get("/", validate({ query: listEquipmentManualsQuerySchema }), getEquipmentManualsList);
equipmentManualsRouter.get("/:manualId", validate({ params: equipmentManualIdParamsSchema }), getEquipmentManualDetail);
equipmentManualsRouter.post(
  "/",
  singleDocumentUploadMiddleware,
  parseMultipartPayload,
  validate({ body: equipmentManualBodySchema }),
  postEquipmentManual,
);
equipmentManualsRouter.patch(
  "/:manualId",
  singleDocumentUploadMiddleware,
  parseMultipartPayload,
  validate({ params: equipmentManualIdParamsSchema, body: updateEquipmentManualBodySchema }),
  patchEquipmentManual,
);
equipmentManualsRouter.delete("/:manualId", validate({ params: equipmentManualIdParamsSchema }), removeEquipmentManual);

export { equipmentManualsRouter };
