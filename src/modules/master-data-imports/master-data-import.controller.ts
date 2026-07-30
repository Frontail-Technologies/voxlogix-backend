import type { Request, Response } from "express";

import { buildFinalMasterDataSampleWorkbook, importFinalMasterDataTemplate } from "@/modules/master-data-imports/master-data-import.service";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { asyncHandler } from "@/shared/helpers/async-handler";
import { sendSuccess } from "@/shared/helpers/api-response";

function companyIdOf(request: Request) {
  const companyId = request.user?.companyId;
  if (!companyId) {
    throw new AppError({
      message: "Company context is required for master-data import.",
      statusCode: HTTP_STATUS.BAD_REQUEST,
      errorCode: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return companyId;
}

export const postFinalMasterDataTemplate = asyncHandler(async (request: Request, response: Response) => {
  if (!request.file) {
    throw new AppError({
      message: "Upload the final master-data Excel file.",
      statusCode: HTTP_STATUS.BAD_REQUEST,
      errorCode: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const result = await importFinalMasterDataTemplate({
    companyId: companyIdOf(request),
    fileName: request.file.originalname,
    buffer: request.file.buffer,
  });

  return sendSuccess(response, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Master data imported successfully.",
    data: result,
  });
});


export const getFinalMasterDataSampleTemplate = asyncHandler(async (_request: Request, response: Response) => {
  const buffer = buildFinalMasterDataSampleWorkbook();

  response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  response.setHeader("Content-Disposition", 'attachment; filename="VoxLogiX-Master-Data-Sample.xlsx"');
  response.send(buffer);
});
