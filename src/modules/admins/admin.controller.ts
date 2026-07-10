import type { Request, Response } from "express";

import { asyncHandler } from "@/shared/helpers/async-handler";
import { sendSuccess } from "@/shared/helpers/api-response";

import {
  createAdmin,
  deleteAdmin,
  getAdminById,
  listAdmins,
  resetAdminPassword,
  updateAdmin,
} from "./admin.service";

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

export const getAdmins = asyncHandler(async (request: Request, response: Response) => {
  const search = typeof request.query.search === "string" ? request.query.search : undefined;
  const companyId =
    typeof request.query.companyId === "string" ? request.query.companyId : undefined;
  const status = typeof request.query.status === "string" ? request.query.status : undefined;
  const page = Number(request.query.page ?? 1);
  const limit = Number(request.query.limit ?? 20);

  const result = await listAdmins({ page, limit, search, companyId, status });

  return sendSuccess(response, {
    data: result.items,
    meta: result.pagination,
  });
});

export const getAdmin = asyncHandler(async (request: Request, response: Response) => {
  const admin = await getAdminById(getParam(request.params.adminId));

  return sendSuccess(response, {
    data: admin,
  });
});

export const postAdmin = asyncHandler(async (request: Request, response: Response) => {
  const admin = await createAdmin(request.body);

  return sendSuccess(response, {
    statusCode: 201,
    message: "Admin created successfully",
    data: admin,
  });
});

export const patchAdmin = asyncHandler(async (request: Request, response: Response) => {
  const admin = await updateAdmin(getParam(request.params.adminId), request.body);

  return sendSuccess(response, {
    message: "Admin updated successfully",
    data: admin,
  });
});

export const postAdminPasswordReset = asyncHandler(
  async (request: Request, response: Response) => {
    const result = await resetAdminPassword(
      getParam(request.params.adminId),
      request.body,
    );

    return sendSuccess(response, {
      message: "Admin password reset successfully",
      data: result,
    });
  },
);

export const removeAdmin = asyncHandler(async (request: Request, response: Response) => {
  const result = await deleteAdmin(getParam(request.params.adminId));

  return sendSuccess(response, {
    message: "Admin deleted successfully",
    data: result,
  });
});
