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
  postResetPasswordWithToken,
} from "./auth.controller";
import {
  changePasswordBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  resetPasswordWithTokenBodySchema,
} from "./auth.validation";

const authRouter = Router();

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
  "/reset-password",
  authRateLimitMiddleware,
  validate({ body: resetPasswordWithTokenBodySchema }),
  postResetPasswordWithToken,
);

export { authRouter };
