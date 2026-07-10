import type { CorsOptions } from "cors";

import { env } from "@/config/env";

function normalizeOrigins(): string[] {
  return env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const allowedOrigins = normalizeOrigins();

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
