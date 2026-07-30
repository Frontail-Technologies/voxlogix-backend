import type { Request, Response } from "express";

import { listActivities } from "@/modules/activities/activity.service";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";

export const getActivities = asyncHandler(
  async (request: Request, response: Response) => {
    const search = typeof request.query.search === "string" ? request.query.search : undefined;
    const area = typeof request.query.area === "string" ? request.query.area : undefined;
    const action =
      typeof request.query.action === "string" ? request.query.action : undefined;
    const status =
      typeof request.query.status === "string" ? request.query.status : undefined;
    const page = Number(request.query.page ?? 1);
    const limit = Number(request.query.limit ?? 20);

    const result = await listActivities({ page, limit, search, area, action, status });

    return sendSuccess(response, {
      data: result.items,
      meta: result.pagination,
    });
  },
);
