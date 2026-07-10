import jwt, { type SignOptions, type JwtPayload } from "jsonwebtoken";

import { env } from "@/config/env";

type TokenPayload = JwtPayload & {
  userId?: string;
  role?: string;
  email?: string;
};

function signToken(
  payload: TokenPayload,
  secret: string,
  expiresIn: string,
) {
  return jwt.sign(payload, secret, { expiresIn } as SignOptions);
}

function verifyToken(token: string, secret: string): TokenPayload | null {
  try {
    return jwt.verify(token, secret) as TokenPayload;
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
