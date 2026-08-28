import type { CorsOptions } from "cors";

import { env } from "@/config/env";

function normalizeOrigins(): string[] {
  return env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

// Reused by csrf-origin-check.middleware.ts — the trusted-frontend-origin
// list is a single source of truth for both "can this origin call the API
// cross-origin at all" (CORS) and "is this origin allowed to make a
// cookie-authenticated state-changing request" (CSRF defense).
export const allowedOrigins = normalizeOrigins();

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true,
};
