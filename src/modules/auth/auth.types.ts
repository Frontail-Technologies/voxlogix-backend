import type { z } from "zod";

import type {
  changePasswordBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  resetPasswordBodySchema,
  verifyResetOtpBodySchema,
} from "./auth.validation";

export type LoginInput = z.infer<typeof loginBodySchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordBodySchema> & {
  userId: string;
};
export type ForgotPasswordInput = z.infer<typeof forgotPasswordBodySchema>;
export type VerifyResetOtpInput = z.infer<typeof verifyResetOtpBodySchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordBodySchema>;

export type SessionUser = {
  id: string;
  fullName: string;
  initials: string;
  avatarUrl: string | null;
  username: string;
  email: string;
  role: string;
  requirePasswordReset: boolean;
  company: {
    id: string;
    name: string;
  };
};

