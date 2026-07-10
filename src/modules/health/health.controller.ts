import type { Request, Response } from "express";

import { appConfig } from "@/config/app.config";
import { sendSuccess } from "@/shared/helpers/api-response";

export function getHealth(_request: Request, response: Response) {
  return sendSuccess(response, {
    message: "VoxLogiX API is running",
    data: {
      status: "ok",
      version: "unversioned",
      environment: appConfig.environment,
    },
  });
}
