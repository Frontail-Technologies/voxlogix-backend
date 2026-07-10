import { Router } from "express";

import { adminsRouter } from "@/modules/admins/admin.routes";
import { companiesRouter } from "@/modules/companies/company.routes";
import { healthRouter } from "@/modules/health/health.routes";
import { modulesRouter } from "@/modules/modules/module.routes";

const moduleRouter = Router();

moduleRouter.use("/health", healthRouter);
moduleRouter.use("/companies", companiesRouter);
moduleRouter.use("/admins", adminsRouter);
moduleRouter.use("/modules", modulesRouter);

export { moduleRouter };
