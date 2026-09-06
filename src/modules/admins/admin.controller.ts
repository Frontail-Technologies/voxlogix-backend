import type { Request, Response } from "express";

import { uploadImageAsset } from "@/modules/uploads/uploads.service";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { asyncHandler } from "@/shared/helpers/async-handler";
import { sendSuccess } from "@/shared/helpers/api-response";
import { USER_ROLES } from "@/shared/constants";

import {
  createAdmin,
  deleteAdmin,
  getAdminById,
  listAdmins,
  resetAdminPassword,
  updateAdmin,
} from "./admin.service";

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : (value ?? "");
}

const NON_ASSIGNABLE_ROLES_FOR_ADMIN: string[] = [
  USER_ROLES.ADMIN,
  USER_ROLES.MASTER,
];

function isMaster(request: Request) {
  return request.user?.role === USER_ROLES.MASTER;
}

function callerCompanyId(request: Request) {
  return String(request.user?.companyId ?? "");
}

// Same-company check for read access. 404, not 403 — a company ADMIN must never be able to
// tell "exists in another company" apart from "doesn't exist" by probing IDs.
function assertSameCompany(
  request: Request,
  admin: { company: { id: string } },
) {
  if (isMaster(request)) return;

  if (admin.company.id !== callerCompanyId(request)) {
    throw new AppError({
      message: "Admin not found.",
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ERROR_CODES.NOT_FOUND,
    });
  }
}

// Stricter check for create/update/delete/reset-password: same company AND the target
// must not itself be an ADMIN or MASTER account — a company ADMIN can manage their own
// Planners/Execution staff, never a peer admin or the platform.
function assertMutableByAdmin(
  request: Request,
  admin: { company: { id: string }; role: string },
) {
  assertSameCompany(request, admin);

  if (
    !isMaster(request) &&
    NON_ASSIGNABLE_ROLES_FOR_ADMIN.includes(admin.role)
  ) {
    throw new AppError({
      message: "You do not have permission to modify this account.",
      statusCode: HTTP_STATUS.FORBIDDEN,
      errorCode: ERROR_CODES.FORBIDDEN,
    });
  }
}

async function uploadAdminAvatar(request: Request) {
  if (!request.file) return null;
  return uploadImageAsset(request.file, {
    folder: "admins",
    context: "admin-avatar",
    fileName: request.body.fullName ?? request.body.username ?? "admin-avatar",
  });
}

export const getAdmins = asyncHandler(
  async (request: Request, response: Response) => {
    const search =
      typeof request.query.search === "string"
        ? request.query.search
        : undefined;
    // A company ADMIN can only ever list their own company's staff — companyId is never
    // trusted from the query string for them, only for MASTER's cross-company view.
    const companyId = isMaster(request)
      ? typeof request.query.companyId === "string"
        ? request.query.companyId
        : undefined
      : callerCompanyId(request);
    const status =
      typeof request.query.status === "string"
        ? request.query.status
        : undefined;
    const role =
      typeof request.query.role === "string" ? request.query.role : undefined;
    const joinedFrom =
      typeof request.query.joinedFrom === "string"
        ? request.query.joinedFrom
        : undefined;
    const joinedTo =
      typeof request.query.joinedTo === "string"
        ? request.query.joinedTo
        : undefined;
    const page = Number(request.query.page ?? 1);
    const limit = Number(request.query.limit ?? 20);

    const result = await listAdmins({
      page,
      limit,
      search,
      companyId,
      status,
      role,
      joinedFrom,
      joinedTo,
    });

    return sendSuccess(response, {
      data: result.items,
      meta: result.pagination,
    });
  },
);

export const getAdmin = asyncHandler(
  async (request: Request, response: Response) => {
    const admin = await getAdminById(getParam(request.params.adminId));
    assertSameCompany(request, admin);

    return sendSuccess(response, {
      data: admin,
    });
  },
);

export const postAdmin = asyncHandler(
  async (request: Request, response: Response) => {
    if (!isMaster(request)) {
      const requestedRole = String(request.body.role ?? "");
      if (NON_ASSIGNABLE_ROLES_FOR_ADMIN.includes(requestedRole)) {
        throw new AppError({
          message: "You can only create Planner or Execution users.",
          statusCode: HTTP_STATUS.FORBIDDEN,
          errorCode: ERROR_CODES.FORBIDDEN,
        });
      }
      // Never trust a client-supplied companyId for a non-MASTER caller — always their own.
      request.body.companyId = callerCompanyId(request);
    }

    const avatar = await uploadAdminAvatar(request);
    const admin = await createAdmin({
      ...request.body,
      ...(avatar
        ? { avatarUrl: avatar.secureUrl ?? avatar.url, avatarKey: avatar.key }
        : {}),
    });

    return sendSuccess(response, {
      statusCode: 201,
      message: "Admin created successfully",
      data: admin,
    });
  },
);

export const patchAdmin = asyncHandler(
  async (request: Request, response: Response) => {
    const existing = await getAdminById(getParam(request.params.adminId));
    assertMutableByAdmin(request, existing);

    if (!isMaster(request)) {
      // A company ADMIN can't move a user to another company or escalate their role.
      delete request.body.companyId;
      if (
        request.body.role &&
        NON_ASSIGNABLE_ROLES_FOR_ADMIN.includes(String(request.body.role))
      ) {
        throw new AppError({
          message: "You can only assign the Planner or Execution role.",
          statusCode: HTTP_STATUS.FORBIDDEN,
          errorCode: ERROR_CODES.FORBIDDEN,
        });
      }
    }

    const avatar = await uploadAdminAvatar(request);
    const admin = await updateAdmin(getParam(request.params.adminId), {
      ...request.body,
      ...(avatar
        ? { avatarUrl: avatar.secureUrl ?? avatar.url, avatarKey: avatar.key }
        : {}),
    });

    return sendSuccess(response, {
      message: "Admin updated successfully",
      data: admin,
    });
  },
);

export const postAdminPasswordReset = asyncHandler(
  async (request: Request, response: Response) => {
    const existing = await getAdminById(getParam(request.params.adminId));
    assertMutableByAdmin(request, existing);

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

export const removeAdmin = asyncHandler(
  async (request: Request, response: Response) => {
    const existing = await getAdminById(getParam(request.params.adminId));
    assertMutableByAdmin(request, existing);

    const result = await deleteAdmin(getParam(request.params.adminId));

    return sendSuccess(response, {
      message: "Admin deleted successfully",
      data: result,
    });
  },
);
