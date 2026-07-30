import type { Request, Response } from "express";

import { listMasterDataOptions } from "@/modules/master-data-options/master-data-option.service";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";

function companyIdOf(request: Request) {
  return String(request.user?.companyId ?? "");
}

export const getMasterDataOptions = asyncHandler(async (request: Request, response: Response) => {
  const result = await listMasterDataOptions({
    companyId: companyIdOf(request),
    sourceKey: request.params.sourceKey as never,
    fieldKey: typeof request.query.fieldKey === "string" ? request.query.fieldKey : undefined,
  });

  return sendSuccess(response, { data: result });
});
