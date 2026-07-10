import { Router } from "express";

import { healthRouter } from "@/modules/health/health.routes";

const moduleRouter = Router();

moduleRouter.use("/health", healthRouter);

export { moduleRouter };
