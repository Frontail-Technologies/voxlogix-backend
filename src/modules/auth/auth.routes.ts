import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
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

authRouter.post("/login", validate({ body: loginBodySchema }), postLogin);
authRouter.post("/refresh", postRefresh);
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
  validate({ body: forgotPasswordBodySchema }),
  postForgotPassword,
);
authRouter.post(
  "/verify-otp",
  validate({ body: verifyResetOtpBodySchema }),
  postVerifyResetOtp,
);
authRouter.post(
  "/reset-password",
  validate({ body: resetPasswordBodySchema }),
  postResetPassword,
);

export { authRouter };
