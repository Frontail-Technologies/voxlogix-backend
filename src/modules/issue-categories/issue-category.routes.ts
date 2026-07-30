import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { USER_ROLES } from "@/shared/constants";

import { getIssueCategories, getIssueCategoryDetail, patchIssueCategory, postIssueCategory, removeIssueCategory } from "./issue-category.controller";
import { issueCategoryBodySchema, issueCategoryIdParamsSchema, listIssueCategoriesQuerySchema, updateIssueCategoryBodySchema } from "./issue-category.validation";

const issueCategoriesRouter = Router();
issueCategoriesRouter.use(requireAuth, requireRole(USER_ROLES.ADMIN, USER_ROLES.MASTER));
issueCategoriesRouter.get("/", validate({ query: listIssueCategoriesQuerySchema }), getIssueCategories);
issueCategoriesRouter.get("/:issueCategoryId", validate({ params: issueCategoryIdParamsSchema }), getIssueCategoryDetail);
issueCategoriesRouter.post("/", validate({ body: issueCategoryBodySchema }), postIssueCategory);
issueCategoriesRouter.patch("/:issueCategoryId", validate({ params: issueCategoryIdParamsSchema, body: updateIssueCategoryBodySchema }), patchIssueCategory);
issueCategoriesRouter.delete("/:issueCategoryId", validate({ params: issueCategoryIdParamsSchema }), removeIssueCategory);

export { issueCategoriesRouter };
