import { and, desc, eq, isNull, or } from "drizzle-orm";

import { env } from "@/config/env";
import { db } from "@/db";
import { adminLoginHistory, admins, authSessions, companies, passwordResetOtps } from "@/db/schema";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  SessionUser,
  VerifyResetOtpInput,
} from "@/modules/auth/auth.types";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/shared/security/jwt";
import { comparePassword, hashPassword } from "@/shared/security/password";
import { passwordResetOtpEmail } from "@/shared/services/email-templates";
import { sendEmail } from "@/shared/services/mailer.service";

const OTP_EXPIRY_MINUTES = 10;

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

// Parses the simple "<number><unit>" duration strings this project's JWT_*_EXPIRES_IN
// env vars already use (e.g. "15m", "7d") — kept local/minimal rather than pulling in
// a duration-parsing dependency for one call site. Falls back to 7 days on an
// unrecognized format so a session row is never created with a bogus/immediate expiry.
function parseDurationMs(duration: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(duration.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unitMs = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as "s" | "m" | "h" | "d"];
  return value * unitMs;
}

async function createSession(admin: SessionAdminRow, meta?: { userAgent?: string }) {
  const tokenPayload = {
    sub: admin.id,
    role: admin.role,
    email: admin.email,
    companyId: admin.companyId,
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

/** Marks one session row revoked (idempotent). Used both by refresh-token
 * rotation (revoke the just-consumed session before minting its successor)
 * and by logout. */
async function revokeSession(sessionId: string) {
  await db.update(authSessions).set({ revokedAt: new Date() }).where(and(eq(authSessions.id, sessionId), isNull(authSessions.revokedAt)));
}

export async function login(input: LoginInput, meta?: { userAgent?: string }) {
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

export async function refreshSession(refreshToken?: string, meta?: { userAgent?: string }) {
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

  // A refresh token minted before this session table existed carries no
  // jti and is rejected here — this forces a one-time re-login for
  // whoever's session was already active at deploy time (see report).
  if (!userId || !sessionId) {
    throw unauthorizedSessionError();
  }

  const [session] = await db.select().from(authSessions).where(eq(authSessions.id, sessionId)).limit(1);

  // Missing, revoked (already rotated away or logged out), expired, or
  // bound to a different admin than the token's own subject claims — all
  // treated identically as "this refresh token no longer works."
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

  // Rotation: this session is spent the moment it's used to refresh. If the
  // same (now-stale) refresh token is presented again — e.g. a stolen copy
  // replayed after the legitimate client already rotated — the check above
  // (`session.revokedAt`) denies it on its next use.
  const rotatedAt = new Date();
  await db.update(authSessions).set({ revokedAt: rotatedAt, lastUsedAt: rotatedAt }).where(eq(authSessions.id, sessionId));

  return createSession(admin, meta);
}

/** Revokes the session a refresh token points to, if any. Used by logout —
 * tolerant of an already-expired/garbage/missing token (nothing to revoke,
 * not an error) since the client-side cookies/storage get cleared either way. */
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

export async function changePassword(input: ChangePasswordInput) {
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

  return { id: admin.id };
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function invalidOtpError() {
  return new AppError({
    message: "Invalid or expired verification code.",
    statusCode: HTTP_STATUS.BAD_REQUEST,
    errorCode: ERROR_CODES.VALIDATION_ERROR,
  });
}

async function findAdminByIdentifier(identifier: string) {
  const value = identifier.trim().toLowerCase();

  const [admin] = await db
    .select({ id: admins.id, fullName: admins.fullName, email: admins.email, status: admins.status })
    .from(admins)
    .where(or(eq(admins.username, value), eq(admins.email, value)))
    .limit(1);

  return admin ?? null;
}

async function findValidOtp(adminId: string, otp: string) {
  const [latest] = await db
    .select({
      id: passwordResetOtps.id,
      otpHash: passwordResetOtps.otpHash,
      expiresAt: passwordResetOtps.expiresAt,
      consumedAt: passwordResetOtps.consumedAt,
    })
    .from(passwordResetOtps)
    .where(eq(passwordResetOtps.adminId, adminId))
    .orderBy(desc(passwordResetOtps.createdAt))
    .limit(1);

  if (!latest || latest.consumedAt || latest.expiresAt.getTime() < Date.now()) {
    return null;
  }

  const matches = await comparePassword(otp, latest.otpHash);
  return matches ? latest : null;
}

export async function requestPasswordReset(input: ForgotPasswordInput) {
  const admin = await findAdminByIdentifier(input.identifier);

  if (admin && admin.status === "ACTIVE") {
    const otp = generateOtp();
    const otpHash = await hashPassword(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000);

    await db.insert(passwordResetOtps).values({ adminId: admin.id, otpHash, expiresAt });

    if (env.NODE_ENV !== "production") {
      console.log(`[auth] Password reset OTP for ${admin.email}: ${otp}`);
    }

    await sendEmail({
      to: admin.email,
      subject: "Reset your VoxLogiX password",
      html: passwordResetOtpEmail({
        fullName: admin.fullName,
        otp,
        expiresInMinutes: OTP_EXPIRY_MINUTES,
      }),
    });
  }

  // Always return a generic response so callers cannot use this endpoint to enumerate accounts.
  return { message: "If an account matches, a reset code has been sent to its email address." };
}

export async function verifyPasswordResetOtp(input: VerifyResetOtpInput) {
  const admin = await findAdminByIdentifier(input.identifier);
  if (!admin) throw invalidOtpError();

  const otpRow = await findValidOtp(admin.id, input.otp);
  if (!otpRow) throw invalidOtpError();

  return { valid: true };
}

export async function resetPasswordWithOtp(input: ResetPasswordInput) {
  const admin = await findAdminByIdentifier(input.identifier);
  if (!admin) throw invalidOtpError();

  const otpRow = await findValidOtp(admin.id, input.otp);
  if (!otpRow) throw invalidOtpError();

  const newPasswordHash = await hashPassword(input.newPassword);

  await db
    .update(admins)
    .set({ passwordHash: newPasswordHash, requirePasswordReset: false, updatedAt: new Date() })
    .where(eq(admins.id, admin.id));

  await db
    .update(passwordResetOtps)
    .set({ consumedAt: new Date() })
    .where(eq(passwordResetOtps.id, otpRow.id));

  return { id: admin.id };
}
