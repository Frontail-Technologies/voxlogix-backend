import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { USER_ROLES } from "@/shared/constants";

import { getEquipmentCategoriesHandler, getEquipmentCategoryDetail, patchEquipmentCategory, postEquipmentCategory, removeEquipmentCategory } from "./equipment-category.controller";
import { equipmentCategoryBodySchema, equipmentCategoryIdParamsSchema, listEquipmentCategoriesQuerySchema, updateEquipmentCategoryBodySchema } from "./equipment-category.validation";

const equipmentCategoriesRouter = Router();
equipmentCategoriesRouter.use(requireAuth, requireRole(USER_ROLES.ADMIN, USER_ROLES.MASTER));
equipmentCategoriesRouter.get("/", validate({ query: listEquipmentCategoriesQuerySchema }), getEquipmentCategoriesHandler);
equipmentCategoriesRouter.get("/:equipmentCategoryId", validate({ params: equipmentCategoryIdParamsSchema }), getEquipmentCategoryDetail);
equipmentCategoriesRouter.post("/", validate({ body: equipmentCategoryBodySchema }), postEquipmentCategory);
equipmentCategoriesRouter.patch("/:equipmentCategoryId", validate({ params: equipmentCategoryIdParamsSchema, body: updateEquipmentCategoryBodySchema }), patchEquipmentCategory);
equipmentCategoriesRouter.delete("/:equipmentCategoryId", validate({ params: equipmentCategoryIdParamsSchema }), removeEquipmentCategory);

export { equipmentCategoriesRouter };
