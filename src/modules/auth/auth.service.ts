import { createHash, randomBytes } from "node:crypto";

import { and, desc, eq, isNull, or } from "drizzle-orm";

import { env } from "@/config/env";
import { db } from "@/db";
import { adminLoginHistory, admins, authSessions, companies, passwordResetTokens } from "@/db/schema";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordWithTokenInput,
  SessionUser,
} from "@/modules/auth/auth.types";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/shared/security/jwt";
import { comparePassword, hashPassword } from "@/shared/security/password";
import { passwordResetLinkEmail } from "@/shared/services/email-templates";
import { sendEmail } from "@/shared/services/mailer.service";

const RESET_TOKEN_EXPIRY_MINUTES = 30;

type SessionAdminRow = {
  id: string;
  fullName: string;
  initials: string;
  avatarUrl: string | null;
  username: string;
  email: string;
  role: string;
  requirePasswordReset: boolean;
  companyId: string;
  companyName: string;
};

export type SessionResult = {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
};

function mapAdminToSessionUser(admin: SessionAdminRow): SessionUser {
  return {
    id: admin.id,
    fullName: admin.fullName,
    initials: admin.initials,
    avatarUrl: admin.avatarUrl,
    username: admin.username,
    email: admin.email,
    role: admin.role,
    requirePasswordReset: admin.requirePasswordReset,
    company: {
      id: admin.companyId,
      name: admin.companyName,
    },
  };
}

function unauthorizedSessionError() {
  return new AppError({
    message: "Session expired. Please log in again.",
    statusCode: HTTP_STATUS.UNAUTHORIZED,
    errorCode: ERROR_CODES.UNAUTHORIZED,
  });
}

function invalidCredentialsError() {
  return new AppError({
    message: "Invalid credentials.",
    statusCode: HTTP_STATUS.UNAUTHORIZED,
    errorCode: ERROR_CODES.UNAUTHORIZED,
  });
}

function parseDurationMs(duration: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(duration.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unitMs = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as "s" | "m" | "h" | "d"];
  return value * unitMs;
}

async function createSession(admin: SessionAdminRow, meta?: { userAgent?: string }): Promise<SessionResult> {
  const tokenPayload = {
    sub: admin.id,
    role: admin.role,
    email: admin.email,
    companyId: admin.companyId,
    requirePasswordReset: admin.requirePasswordReset,
  };

  const [session] = await db
    .insert(authSessions)
    .values({
      adminId: admin.id,
      companyId: admin.companyId,
      expiresAt: new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_EXPIRES_IN)),
      userAgent: meta?.userAgent,
    })
    .returning({ id: authSessions.id });

  return {
    accessToken: signAccessToken(tokenPayload),
    refreshToken: signRefreshToken({ ...tokenPayload, jti: session.id }),
    user: mapAdminToSessionUser(admin),
  };
}

async function revokeSession(sessionId: string) {
  await db.update(authSessions).set({ revokedAt: new Date() }).where(and(eq(authSessions.id, sessionId), isNull(authSessions.revokedAt)));
}

export async function revokeAllSessionsForAdmin(adminId: string) {
  await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(authSessions.adminId, adminId), isNull(authSessions.revokedAt)));
}

export async function login(input: LoginInput, meta?: { userAgent?: string }): Promise<SessionResult> {
  const identifier = input.identifier.trim().toLowerCase();

  const [admin] = await db
    .select({
      id: admins.id,
      fullName: admins.fullName,
      initials: admins.initials,
      avatarUrl: admins.avatarUrl,
      username: admins.username,
      email: admins.email,
      role: admins.role,
      status: admins.status,
      passwordHash: admins.passwordHash,
      requirePasswordReset: admins.requirePasswordReset,
      companyId: companies.id,
      companyName: companies.name,
      companyStatus: companies.status,
    })
    .from(admins)
    .innerJoin(companies, eq(admins.companyId, companies.id))
    .where(or(eq(admins.username, identifier), eq(admins.email, identifier)))
    .limit(1);

  if (!admin) {
    throw invalidCredentialsError();
  }

  const passwordMatches = await comparePassword(input.password, admin.passwordHash);

  if (!passwordMatches) {
    throw invalidCredentialsError();
  }

  if (admin.status !== "ACTIVE") {
    throw new AppError({
      message: "This account is not active. Contact your administrator.",
      statusCode: HTTP_STATUS.FORBIDDEN,
      errorCode: ERROR_CODES.FORBIDDEN,
    });
  }

  if (admin.companyStatus !== "ACTIVE" && admin.companyStatus !== "DEMO") {
    throw new AppError({
      message: "This company's account is not active. Contact support.",
      statusCode: HTTP_STATUS.FORBIDDEN,
      errorCode: ERROR_CODES.FORBIDDEN,
    });
  }

  const now = new Date();

  await db
    .update(admins)
    .set({ lastLoginAt: now, updatedAt: now })
    .where(eq(admins.id, admin.id));

  await db.insert(adminLoginHistory).values({
    adminId: admin.id,
    loggedInAt: now,
  });

  return createSession(admin, meta);
}

export async function refreshSession(refreshToken?: string, meta?: { userAgent?: string }): Promise<SessionResult> {
  if (!refreshToken) {
    throw unauthorizedSessionError();
  }

  const payload = verifyRefreshToken(refreshToken);
  const userId =
    typeof payload?.sub === "string"
      ? payload.sub
      : typeof payload?.userId === "string"
        ? payload.userId
        : undefined;
  const sessionId = typeof payload?.jti === "string" ? payload.jti : undefined;

  if (!userId || !sessionId) {
    throw unauthorizedSessionError();
  }

  const [session] = await db.select().from(authSessions).where(eq(authSessions.id, sessionId)).limit(1);

  if (!session || session.adminId !== userId || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
    throw unauthorizedSessionError();
  }

  const [admin] = await db
    .select({
      id: admins.id,
      fullName: admins.fullName,
      initials: admins.initials,
      avatarUrl: admins.avatarUrl,
      username: admins.username,
      email: admins.email,
      role: admins.role,
      status: admins.status,
      requirePasswordReset: admins.requirePasswordReset,
      companyId: companies.id,
      companyName: companies.name,
      companyStatus: companies.status,
    })
    .from(admins)
    .innerJoin(companies, eq(admins.companyId, companies.id))
    .where(eq(admins.id, userId))
    .limit(1);

  if (!admin) {
    throw unauthorizedSessionError();
  }

  if (admin.status !== "ACTIVE") {
    throw new AppError({
      message: "This account is not active. Contact your administrator.",
      statusCode: HTTP_STATUS.FORBIDDEN,
      errorCode: ERROR_CODES.FORBIDDEN,
    });
  }

  if (admin.companyStatus !== "ACTIVE" && admin.companyStatus !== "DEMO") {
    throw new AppError({
      message: "This company's account is not active. Contact support.",
      statusCode: HTTP_STATUS.FORBIDDEN,
      errorCode: ERROR_CODES.FORBIDDEN,
    });
  }

  const rotatedAt = new Date();
  await db.update(authSessions).set({ revokedAt: rotatedAt, lastUsedAt: rotatedAt }).where(eq(authSessions.id, sessionId));

  return createSession(admin, meta);
}

export async function logout(refreshToken?: string) {
  if (!refreshToken) return;

  const payload = verifyRefreshToken(refreshToken);
  const sessionId = typeof payload?.jti === "string" ? payload.jti : undefined;
  if (!sessionId) return;

  await revokeSession(sessionId);
}

export async function getCurrentUser(userId: string): Promise<SessionUser> {
  const [admin] = await db
    .select({
      id: admins.id,
      fullName: admins.fullName,
      initials: admins.initials,
      avatarUrl: admins.avatarUrl,
      username: admins.username,
      email: admins.email,
      role: admins.role,
      requirePasswordReset: admins.requirePasswordReset,
      companyId: companies.id,
      companyName: companies.name,
    })
    .from(admins)
    .innerJoin(companies, eq(admins.companyId, companies.id))
    .where(eq(admins.id, userId))
    .limit(1);

  if (!admin) {
    throw new AppError({
      message: "Account not found.",
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ERROR_CODES.NOT_FOUND,
    });
  }

  return mapAdminToSessionUser(admin);
}

export async function changePassword(
  input: ChangePasswordInput & { userAgent?: string },
): Promise<SessionResult> {
  const [admin] = await db
    .select({ id: admins.id, passwordHash: admins.passwordHash })
    .from(admins)
    .where(eq(admins.id, input.userId))
    .limit(1);

  if (!admin) {
    throw new AppError({
      message: "Account not found.",
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ERROR_CODES.NOT_FOUND,
    });
  }

  const currentPasswordMatches = await comparePassword(input.currentPassword, admin.passwordHash);

  if (!currentPasswordMatches) {
    throw new AppError({
      message: "Current password is incorrect.",
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      errorCode: ERROR_CODES.UNAUTHORIZED,
    });
  }

  const newPasswordHash = await hashPassword(input.newPassword);

  await db
    .update(admins)
    .set({ passwordHash: newPasswordHash, requirePasswordReset: false, updatedAt: new Date() })
    .where(eq(admins.id, admin.id));

  // Revoke all existing sessions so other devices/browsers are logged out.
  // Then create a fresh session with requirePasswordReset=false in the token
  // so the caller gets new cookies / tokens immediately without a separate login.
  await revokeAllSessionsForAdmin(admin.id);

  const [updatedAdmin] = await db
    .select({
      id: admins.id,
      fullName: admins.fullName,
      initials: admins.initials,
      avatarUrl: admins.avatarUrl,
      username: admins.username,
      email: admins.email,
      role: admins.role,
      requirePasswordReset: admins.requirePasswordReset,
      companyId: companies.id,
      companyName: companies.name,
    })
    .from(admins)
    .innerJoin(companies, eq(admins.companyId, companies.id))
    .where(eq(admins.id, admin.id))
    .limit(1);

  if (!updatedAdmin) throw unauthorizedSessionError();

  return createSession(updatedAdmin, { userAgent: input.userAgent });
}

async function findAdminByIdentifier(identifier: string) {
  const value = identifier.trim().toLowerCase();

  const [admin] = await db
    .select({
      id: admins.id,
      fullName: admins.fullName,
      email: admins.email,
      status: admins.status,
      companyStatus: companies.status,
    })
    .from(admins)
    .innerJoin(companies, eq(admins.companyId, companies.id))
    .where(or(eq(admins.username, value), eq(admins.email, value)))
    .limit(1);

  return admin ?? null;
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function requestPasswordReset(input: ForgotPasswordInput) {
  const admin = await findAdminByIdentifier(input.identifier);

  // Only send for ACTIVE accounts in ACTIVE/DEMO companies — same checks as login.
  if (admin && admin.status === "ACTIVE" && (admin.companyStatus === "ACTIVE" || admin.companyStatus === "DEMO")) {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60_000);

    // Invalidate any previous unused tokens for this admin so there is only
    // ever one valid outstanding reset link at a time.
    await db
      .update(passwordResetTokens)
      .set({ consumedAt: new Date() })
      .where(and(eq(passwordResetTokens.adminId, admin.id), isNull(passwordResetTokens.consumedAt)));

    await db.insert(passwordResetTokens).values({ adminId: admin.id, tokenHash, expiresAt });

    const baseUrl = env.PASSWORD_RESET_WEB_URL || "http://localhost:3000/reset-password";
    const resetUrl = `${baseUrl}?token=${rawToken}`;

    await sendEmail({
      to: admin.email,
      subject: "Reset your VoxLogiX password",
      html: passwordResetLinkEmail({
        fullName: admin.fullName,
        resetUrl,
        expiresInMinutes: RESET_TOKEN_EXPIRY_MINUTES,
      }),
    });
  }

  return { message: "If an account exists for this email, a password reset link has been sent." };
}

function invalidTokenError() {
  return new AppError({
    message: "This reset link is invalid or has expired.",
    statusCode: HTTP_STATUS.BAD_REQUEST,
    errorCode: ERROR_CODES.VALIDATION_ERROR,
  });
}

export async function resetPasswordWithToken(input: ResetPasswordWithTokenInput) {
  const tokenHash = hashToken(input.token);

  const [tokenRow] = await db
    .select({
      id: passwordResetTokens.id,
      adminId: passwordResetTokens.adminId,
      expiresAt: passwordResetTokens.expiresAt,
      consumedAt: passwordResetTokens.consumedAt,
    })
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .orderBy(desc(passwordResetTokens.createdAt))
    .limit(1);

  if (!tokenRow || tokenRow.consumedAt || tokenRow.expiresAt.getTime() < Date.now()) {
    throw invalidTokenError();
  }

  const newPasswordHash = await hashPassword(input.newPassword);

  await db
    .update(admins)
    .set({ passwordHash: newPasswordHash, requirePasswordReset: false, updatedAt: new Date() })
    .where(eq(admins.id, tokenRow.adminId));

  await db
    .update(passwordResetTokens)
    .set({ consumedAt: new Date() })
    .where(eq(passwordResetTokens.id, tokenRow.id));

  // Revoke all sessions — after a forgotten-password reset the user must log in fresh.
  await revokeAllSessionsForAdmin(tokenRow.adminId);

  return { message: "Password reset successfully. Please sign in." };
}
