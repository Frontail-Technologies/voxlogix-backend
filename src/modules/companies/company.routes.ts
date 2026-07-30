import { Router } from "express";

import { parseMultipartPayload } from "@/middlewares/multipart-payload.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { singleImageUploadMiddleware } from "@/modules/uploads/uploads.middleware";

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
