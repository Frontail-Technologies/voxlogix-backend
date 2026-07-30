import { z } from "zod";

import { USER_ROLES, USER_STATUS } from "@/shared/constants";
import { paginationQuerySchema } from "@/shared/validators/pagination.validation";

const adminStatusValues = Object.values(USER_STATUS) as [string, ...string[]];
const roleValues = Object.values(USER_ROLES) as [string, ...string[]];
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password must be at most 100 characters");

export const listAdminsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  companyId: z.string().uuid().optional(),
  status: z.enum(adminStatusValues).optional(),
  role: z.enum(roleValues).optional(),
  joinedFrom: z.string().trim().optional(),
  joinedTo: z.string().trim().optional(),
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
  role: z.enum(roleValues).default(USER_ROLES.ADMIN),
  status: z.enum(adminStatusValues),
  requirePasswordReset: z.boolean().optional(),
  sendWelcomeEmail: z.boolean().optional(),
  avatarUrl: z.string().trim().url().max(2000).nullable().optional(),
  avatarKey: z.string().trim().max(2000).nullable().optional(),
};

export const createAdminBodySchema = z
  .object({
    ...sharedAdminFields,
    temporaryPassword: passwordSchema,
    confirmPassword: passwordSchema,
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
    role: z.enum(roleValues).optional(),
    status: sharedAdminFields.status.optional(),
    requirePasswordReset: sharedAdminFields.requirePasswordReset,
    sendWelcomeEmail: sharedAdminFields.sendWelcomeEmail,
    avatarUrl: sharedAdminFields.avatarUrl,
    avatarKey: sharedAdminFields.avatarKey,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const resetAdminPasswordBodySchema = z
  .object({
    temporaryPassword: passwordSchema,
    confirmPassword: passwordSchema,
    requireResetOnNextLogin: z.boolean().default(true),
    sendNotificationEmail: z.boolean().default(true),
  })
  .refine((value) => value.temporaryPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
