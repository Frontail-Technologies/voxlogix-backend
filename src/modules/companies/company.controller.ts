import type { Request, Response } from "express";

import { asyncHandler } from "@/shared/helpers/async-handler";
import { sendSuccess } from "@/shared/helpers/api-response";

import {
  getCompanyById,
  listCompanies,
  listCompanyOptions,
} from "./company.service";

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

export const getCompanies = asyncHandler(async (request: Request, response: Response) => {
  const search = typeof request.query.search === "string" ? request.query.search : undefined;
  const status = typeof request.query.status === "string" ? request.query.status : undefined;
  const page = Number(request.query.page ?? 1);
  const limit = Number(request.query.limit ?? 20);

  const result = await listCompanies({ page, limit, search, status });

  return sendSuccess(response, {
    data: result.items,
    meta: result.pagination,
  });
});

export const getCompanyOptions = asyncHandler(
  async (_request: Request, response: Response) => {
    const options = await listCompanyOptions();

    return sendSuccess(response, {
      data: options,
    });
  },
);

export const getCompany = asyncHandler(async (request: Request, response: Response) => {
  const company = await getCompanyById(getParam(request.params.companyId));

  return sendSuccess(response, {
    data: company,
  });
});
