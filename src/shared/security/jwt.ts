import jwt, { type SignOptions, type JwtPayload } from "jsonwebtoken";

import { env } from "@/config/env";

type TokenPayload = JwtPayload & {
  userId?: string;
  role?: string;
  email?: string;
  companyId?: string;
  /** Refresh tokens only: the auth_sessions row id this token is bound to.
   * Access tokens never carry this — they stay stateless. */
  jti?: string;
};

// Pinned explicitly rather than relying on jsonwebtoken's default algorithm
// inference — defense-in-depth against alg-confusion-class attacks even
// though a plain-string HMAC secret already prevents them by default.
const JWT_ALGORITHM = "HS256";

function signToken(
  payload: TokenPayload,
  secret: string,
  expiresIn: string,
) {
  return jwt.sign(payload, secret, { expiresIn, algorithm: JWT_ALGORITHM } as SignOptions);
}

function verifyToken(token: string, secret: string): TokenPayload | null {
  try {
    return jwt.verify(token, secret, { algorithms: [JWT_ALGORITHM] }) as TokenPayload;
  } catch {
    return null;
  }
}

export function signAccessToken(payload: TokenPayload) {
  return signToken(payload, env.JWT_ACCESS_SECRET, env.JWT_ACCESS_EXPIRES_IN);
}

export function signRefreshToken(payload: TokenPayload) {
  return signToken(payload, env.JWT_REFRESH_SECRET, env.JWT_REFRESH_EXPIRES_IN);
}

export function verifyAccessToken(token: string) {
  return verifyToken(token, env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token: string) {
  return verifyToken(token, env.JWT_REFRESH_SECRET);
}
