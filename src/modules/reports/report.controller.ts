import type { Request, Response } from "express";

import { getKpiDashboard } from "@/modules/reports/kpi-dashboard.service";
import { buildOutputReportWorkbook, outputReportFilename } from "@/modules/reports/output-report.excel";
import {
  buildOutputReportDataset,
  getOutputReportSummary,
  resolveOutputReportCompanyId,
} from "@/modules/reports/output-report.service";
import { sendSuccess } from "@/shared/helpers/api-response";
import { asyncHandler } from "@/shared/helpers/async-handler";

function queryValue(request: Request, key: string) {
  const value = request.query[key];
  return Array.isArray(value) ? String(value[0]) : String(value ?? "");
}

export const getOutputReportSummaryController = asyncHandler(async (request: Request, response: Response) => {
  const companyId = await resolveOutputReportCompanyId({
    role: request.user?.role,
    sessionCompanyId: request.user?.companyId,
    requestedCompanyId: typeof request.query.companyId === "string" ? request.query.companyId : undefined,
  });

  return sendSuccess(response, {
    data: await getOutputReportSummary({
      companyId,
      fromDate: queryValue(request, "fromDate"),
      toDate: queryValue(request, "toDate"),
    }),
  });
});

export const getKpiDashboardController = asyncHandler(async (request: Request, response: Response) => {
  const companyId = await resolveOutputReportCompanyId({
    role: request.user?.role,
    sessionCompanyId: request.user?.companyId,
    requestedCompanyId: typeof request.query.companyId === "string" ? request.query.companyId : undefined,
  });

  return sendSuccess(response, {
    data: await getKpiDashboard({
      companyId,
      fromDate: queryValue(request, "fromDate"),
      toDate: queryValue(request, "toDate"),
    }),
  });
});

export const downloadOutputReportController = asyncHandler(async (request: Request, response: Response) => {
  const companyId = await resolveOutputReportCompanyId({
    role: request.user?.role,
    sessionCompanyId: request.user?.companyId,
    requestedCompanyId: typeof request.query.companyId === "string" ? request.query.companyId : undefined,
    requireExport: true,
  });

  const dataset = await buildOutputReportDataset({
    companyId,
    fromDate: queryValue(request, "fromDate"),
    toDate: queryValue(request, "toDate"),
  });
  const buffer = await buildOutputReportWorkbook(dataset);
  const filename = outputReportFilename(queryValue(request, "fromDate"), queryValue(request, "toDate"), dataset.company.name);

  response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  response.setHeader("Content-Length", buffer.length);
  return response.status(200).send(buffer);
});
