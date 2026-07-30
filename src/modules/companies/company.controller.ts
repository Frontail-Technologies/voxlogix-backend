import type { Request, Response } from "express";

import { uploadImageAsset } from "@/modules/uploads/uploads.service";
import { asyncHandler } from "@/shared/helpers/async-handler";
import { sendSuccess } from "@/shared/helpers/api-response";

import {
  createCompany,
  deleteCompany,
  getCompanyById,
  getCompanyAccessById,
  listCompanies,
  listCompanyOptions,
  updateCompany,
  updateCompanyAccessById,
} from "./company.service";

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

async function uploadCompanyLogo(request: Request) {
  if (!request.file) return null;
  return uploadImageAsset(request.file, {
    folder: "companies",
    context: "company-logo",
    fileName: request.body.companyName ?? "company-logo",
  });
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

export const postCompany = asyncHandler(async (request: Request, response: Response) => {
  const logo = await uploadCompanyLogo(request);
  const company = await createCompany({
    ...request.body,
    ...(logo ? { logoUrl: logo.secureUrl ?? logo.url, logoKey: logo.key } : {}),
  });

  return sendSuccess(response, {
    statusCode: 201,
    message: "Company created successfully",
    data: company,
  });
});

export const patchCompany = asyncHandler(async (request: Request, response: Response) => {
  const logo = await uploadCompanyLogo(request);
  const company = await updateCompany(getParam(request.params.companyId), {
    ...request.body,
    ...(logo ? { logoUrl: logo.secureUrl ?? logo.url, logoKey: logo.key } : {}),
  });

  return sendSuccess(response, {
    message: "Company updated successfully",
    data: company,
  });
});

export const removeCompany = asyncHandler(async (request: Request, response: Response) => {
  const result = await deleteCompany(getParam(request.params.companyId));

  return sendSuccess(response, {
    message: "Company deleted successfully",
    data: result,
  });
});

export const getCompanyAccess = asyncHandler(
  async (request: Request, response: Response) => {
    const result = await getCompanyAccessById(getParam(request.params.companyId));

    return sendSuccess(response, {
      data: result,
    });
  },
);

export const patchCompanyAccess = asyncHandler(
  async (request: Request, response: Response) => {
    const result = await updateCompanyAccessById(
      getParam(request.params.companyId),
      request.body,
    );

    return sendSuccess(response, {
      message: "Company access updated successfully",
      data: result,
    });
  },
);
