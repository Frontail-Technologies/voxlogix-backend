import { pgEnum } from "drizzle-orm/pg-core";

import {
  COMPANY_STATUS,
  MODULE_STATUS,
  USER_ROLES,
  USER_STATUS,
} from "@/shared/constants";

const companyStatusValues = Object.values(COMPANY_STATUS) as [
  string,
  ...string[],
];
const moduleStatusValues = Object.values(MODULE_STATUS) as [string, ...string[]];
const userRoleValues = Object.values(USER_ROLES) as [string, ...string[]];
const userStatusValues = Object.values(USER_STATUS) as [string, ...string[]];

export const companyStatusEnum = pgEnum("company_status", companyStatusValues);
export const moduleStatusEnum = pgEnum("module_status", moduleStatusValues);
export const userRoleEnum = pgEnum("user_role", userRoleValues);
export const userStatusEnum = pgEnum("user_status", userStatusValues);
