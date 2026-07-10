import dotenv from "dotenv";
import { z } from "zod";

import {
  DEFAULT_BODY_SIZE_LIMIT,
  DEFAULT_PORT,
  DEFAULT_RATE_LIMIT_MAX_REQUESTS,
  DEFAULT_RATE_LIMIT_WINDOW_MS,
} from "@/config/constants";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().min(2),
  JWT_REFRESH_EXPIRES_IN: z.string().min(2),
  CLIENT_WEB_URL: z.url(),
  CLIENT_MOBILE_URL: z.string().optional().default(""),
  CORS_ORIGIN: z.string().min(1),
  BODY_SIZE_LIMIT: z.string().default(DEFAULT_BODY_SIZE_LIMIT),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_RATE_LIMIT_WINDOW_MS),
  RATE_LIMIT_MAX_REQUESTS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_RATE_LIMIT_MAX_REQUESTS),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsedEnv.data;
