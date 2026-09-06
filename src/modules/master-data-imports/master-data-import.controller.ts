import type { Request, Response } from "express";

import {
  buildFinalMasterDataSampleWorkbook,
  buildMasterDataImportPreview,
  commitMasterDataImport,
} from "@/modules/master-data-imports/master-data-import.service";
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

// Phase 1: parse + validate the uploaded workbook and return a preview model. No production
// writes happen here — module enablement, required fields, dedupe, etc. are all evaluated
// for display only. The client reviews/edits/removes rows against this, then sends back
// exactly what it wants written to postMasterDataImportCommit below, which independently
// re-verifies everything against the authenticated company before writing anything.
export const postMasterDataImportPreview = asyncHandler(async (request: Request, response: Response) => {
  if (!request.file) {
    throw new AppError({
      message: "Upload the master-data Excel file.",
      statusCode: HTTP_STATUS.BAD_REQUEST,
      errorCode: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const preview = await buildMasterDataImportPreview({
    companyId: companyIdOf(request),
    fileName: request.file.originalname,
    buffer: request.file.buffer,
  });

  return sendSuccess(response, {
    data: preview,
  });
});

// Phase 2: commit the reviewed rows. companyId always comes from the verified auth context,
// never the request body — module enablement is re-resolved fresh here too, so a tampered
// client payload claiming a disabled module's rows are fine still gets rejected server-side.
export const postMasterDataImportCommit = asyncHandler(async (request: Request, response: Response) => {
  const result = await commitMasterDataImport({
    companyId: companyIdOf(request),
    sheets: request.body.sheets,
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
