import { Router } from "express";

import { validate } from "@/middlewares/validate.middleware";

import {
  getCompanies,
  getCompany,
  getCompanyOptions,
} from "./company.controller";
import {
  companyIdParamsSchema,
  listCompaniesQuerySchema,
} from "./company.validation";

const companiesRouter = Router();

companiesRouter.get("/", validate({ query: listCompaniesQuerySchema }), getCompanies);
companiesRouter.get("/options", getCompanyOptions);
companiesRouter.get("/:companyId", validate({ params: companyIdParamsSchema }), getCompany);

export { companiesRouter };
