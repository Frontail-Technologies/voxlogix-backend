import { Router } from "express";

import { parseMultipartPayload } from "@/middlewares/multipart-payload.middleware";
import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { singleImageUploadMiddleware } from "@/modules/uploads/uploads.middleware";
import { USER_ROLES } from "@/shared/constants";

import {
  getCompanyAccess,
  getCompanies,
  getCompany,
  getCompanyOptions,
  patchCompany,
  patchCompanyAccess,
  postCompany,
  removeCompany,
} from "./company.controller";
import {
  companyIdParamsSchema,
  createCompanyBodySchema,
  listCompaniesQuerySchema,
  updateCompanyAccessBodySchema,
  updateCompanyBodySchema,
} from "./company.validation";

const companiesRouter = Router();
// Cross-company tenant administration (create/edit/delete ANY company, view
// or change its feature-access flags) — only used by the master-companies
// frontend feature. Was previously fully unauthenticated; see security audit.
companiesRouter.use(requireAuth, requireRole(USER_ROLES.MASTER));

companiesRouter.get("/", validate({ query: listCompaniesQuerySchema }), getCompanies);
companiesRouter.post(
  "/",
  singleImageUploadMiddleware,
  parseMultipartPayload,
  validate({ body: createCompanyBodySchema }),
  postCompany,
);
companiesRouter.get("/options", getCompanyOptions);
companiesRouter.get("/:companyId", validate({ params: companyIdParamsSchema }), getCompany);
companiesRouter.patch(
  "/:companyId",
  singleImageUploadMiddleware,
  parseMultipartPayload,
  validate({ params: companyIdParamsSchema, body: updateCompanyBodySchema }),
  patchCompany,
);
companiesRouter.delete(
  "/:companyId",
  validate({ params: companyIdParamsSchema }),
  removeCompany,
);
companiesRouter.get(
  "/:companyId/access",
  validate({ params: companyIdParamsSchema }),
  getCompanyAccess,
);
companiesRouter.patch(
  "/:companyId/access",
  validate({
    params: companyIdParamsSchema,
    body: updateCompanyAccessBodySchema,
  }),
  patchCompanyAccess,
);

export { companiesRouter };
