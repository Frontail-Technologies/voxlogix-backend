import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { authRateLimitMiddleware } from "@/middlewares/rate-limit.middleware";
import { validate } from "@/middlewares/validate.middleware";

import {
  getMe,
  postChangePassword,
  postForgotPassword,
  postLogin,
  postLogout,
  postRefresh,
  postResetPassword,
  postVerifyResetOtp,
} from "./auth.controller";
import {
  changePasswordBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  resetPasswordBodySchema,
  verifyResetOtpBodySchema,
} from "./auth.validation";

const authRouter = Router();

// Credential-guessing surface (login, refresh, OTP verify/reset) gets a
// dedicated tighter rate limit; see security audit.
authRouter.post("/login", authRateLimitMiddleware, validate({ body: loginBodySchema }), postLogin);
authRouter.post("/refresh", authRateLimitMiddleware, postRefresh);
authRouter.get("/me", requireAuth, getMe);
authRouter.post("/logout", postLogout);
authRouter.post(
  "/change-password",
  requireAuth,
  validate({ body: changePasswordBodySchema }),
  postChangePassword,
);
authRouter.post(
  "/forgot-password",
  authRateLimitMiddleware,
  validate({ body: forgotPasswordBodySchema }),
  postForgotPassword,
);
authRouter.post(
  "/verify-otp",
  authRateLimitMiddleware,
  validate({ body: verifyResetOtpBodySchema }),
  postVerifyResetOtp,
);
authRouter.post(
  "/reset-password",
  authRateLimitMiddleware,
  validate({ body: resetPasswordBodySchema }),
  postResetPassword,
);

export { authRouter };
