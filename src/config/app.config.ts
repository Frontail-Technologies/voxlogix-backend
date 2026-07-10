import {
  ACCESS_TOKEN_COOKIE_NAME,
  API_BASE_PATH,
  DEFAULT_BODY_SIZE_LIMIT,
  REFRESH_TOKEN_COOKIE_NAME,
} from "@/config/constants";
import { env } from "@/config/env";

export const appConfig = {
  appName: "VoxLogiX API",
  port: env.PORT,
  environment: env.NODE_ENV,
  apiBasePath: API_BASE_PATH,
  bodySizeLimit: env.BODY_SIZE_LIMIT || DEFAULT_BODY_SIZE_LIMIT,
  cookieNames: {
    accessToken: ACCESS_TOKEN_COOKIE_NAME,
    refreshToken: REFRESH_TOKEN_COOKIE_NAME,
  },
} as const;
