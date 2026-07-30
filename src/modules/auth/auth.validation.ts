import { z } from "zod";

export const loginBodySchema = z.object({
  identifier: z.string().trim().min(3).max(255),
  password: z.string().min(1).max(100),
});

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(100),
  newPassword: z.string().min(6).max(100),
});

export const forgotPasswordBodySchema = z.object({
  identifier: z.string().trim().min(3).max(255),
});

export const verifyResetOtpBodySchema = z.object({
  identifier: z.string().trim().min(3).max(255),
  otp: z.string().trim().length(6),
});

export const resetPasswordBodySchema = z
  .object({
    identifier: z.string().trim().min(3).max(255),
    otp: z.string().trim().length(6),
    newPassword: z.string().min(6).max(100),
    confirmPassword: z.string().min(6).max(100),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
