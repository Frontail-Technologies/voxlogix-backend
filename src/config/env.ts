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
  COOKIE_DOMAIN: z.string().optional(),
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
  RATE_LIMIT_ENABLED: z.coerce.boolean().default(false),
  STORAGE_PROVIDER: z.enum(["cloudinary", "s3"]).default("cloudinary"),
  STORAGE_MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(10),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),
  CLOUDINARY_UPLOAD_FOLDER: z.string().optional().default("voxlogix"),
  AWS_ACCESS_KEY_ID: z.string().optional().default(""),
  AWS_SECRET_ACCESS_KEY: z.string().optional().default(""),
  AWS_S3_REGION: z.string().optional().default(""),
  AWS_S3_BUCKET: z.string().optional().default(""),
  AWS_S3_ENDPOINT: z.string().optional().default(""),
  AWS_S3_PUBLIC_BASE_URL: z.string().optional().default(""),
  AWS_S3_UPLOAD_PREFIX: z.string().optional().default("voxlogix"),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_EXTRACTION_MODEL: z.string().optional().default("gemini-flash-lite-latest"),
  GEMINI_CHAT_MODEL: z.string().optional().default("gemini-flash-latest"),
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().int().positive().optional().default(587),
  SMTP_SECURE: z.coerce.boolean().optional().default(false),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASSWORD: z.string().optional().default(""),
  SMTP_FROM_EMAIL: z.string().optional().default(""),
  SMTP_FROM_NAME: z.string().optional().default("VoxLogiX"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsedEnv.data;
