import { z } from "zod";

import { USER_STATUS } from "@/shared/constants";
import { paginationQuerySchema } from "@/shared/validators/pagination.validation";

const adminStatusValues = Object.values(USER_STATUS) as [string, ...string[]];

export const listAdminsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  companyId: z.string().uuid().optional(),
  status: z.enum(adminStatusValues).optional(),
});

export const adminIdParamsSchema = z.object({
  adminId: z.string().uuid(),
});

const sharedAdminFields = {
  fullName: z.string().trim().min(2).max(160),
  username: z.string().trim().min(3).max(80),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(8).max(32),
  companyId: z.string().uuid(),
  status: z.enum(adminStatusValues),
  requirePasswordReset: z.boolean().optional(),
  sendWelcomeEmail: z.boolean().optional(),
};

export const createAdminBodySchema = z
  .object({
    ...sharedAdminFields,
    temporaryPassword: z.string().min(8).max(100),
    confirmPassword: z.string().min(8).max(100),
  })
  .refine((value) => value.temporaryPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const updateAdminBodySchema = z
  .object({
    fullName: sharedAdminFields.fullName.optional(),
    username: sharedAdminFields.username.optional(),
    email: sharedAdminFields.email.optional(),
    phone: sharedAdminFields.phone.optional(),
    companyId: sharedAdminFields.companyId.optional(),
    status: sharedAdminFields.status.optional(),
    requirePasswordReset: z.boolean().optional(),
    sendWelcomeEmail: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const resetAdminPasswordBodySchema = z
  .object({
    temporaryPassword: z.string().min(8).max(100),
    confirmPassword: z.string().min(8).max(100),
    requireResetOnNextLogin: z.boolean().default(true),
    sendNotificationEmail: z.boolean().default(true),
  })
  .refine((value) => value.temporaryPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
