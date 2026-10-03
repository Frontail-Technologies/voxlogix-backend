import type { z } from "zod";

import type {
  changePasswordBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  resetPasswordWithTokenBodySchema,
} from "./auth.validation";

export type LoginInput = z.infer<typeof loginBodySchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordBodySchema> & {
  userId: string;
};
export type ForgotPasswordInput = z.infer<typeof forgotPasswordBodySchema>;
export type ResetPasswordWithTokenInput = z.infer<typeof resetPasswordWithTokenBodySchema>;

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
