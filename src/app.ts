import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { appConfig } from "@/config/app.config";
import { corsOptions } from "@/config/cors";
import { authPlaceholderMiddleware } from "@/middlewares/auth-placeholder.middleware";
import { errorMiddleware } from "@/middlewares/error.middleware";
import { notFoundMiddleware } from "@/middlewares/not-found.middleware";
import { rateLimitMiddleware } from "@/middlewares/rate-limit.middleware";
import { requestLoggerMiddleware } from "@/middlewares/request-logger.middleware";
import { moduleRouter } from "@/modules";

const app = express();

app.use(helmet());
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: appConfig.bodySizeLimit }));
app.use(express.urlencoded({ extended: true, limit: appConfig.bodySizeLimit }));
app.use(requestLoggerMiddleware);
app.use(rateLimitMiddleware);
app.use(authPlaceholderMiddleware);

app.use(appConfig.apiBasePath, moduleRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export { app };
