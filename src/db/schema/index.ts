export * from "@/db/schema/enums.schema";
export * from "@/db/schema/companies.schema";
export * from "@/db/schema/admins.schema";
export * from "@/db/schema/modules.schema";
export * from "@/db/schema/platform.schema";
export * from "@/db/schema/operational.schema";
export * from "@/db/schema/ai.schema";

import {
  companyStatusEnum,
  moduleStatusEnum,
  userRoleEnum,
  userStatusEnum,
} from "@/db/schema/enums.schema";
import { companies } from "@/db/schema/companies.schema";
import { admins, adminLoginHistory, passwordResetOtps } from "@/db/schema/admins.schema";
import { moduleCategories, moduleFields, modules, moduleTypes } from "@/db/schema/modules.schema";
import {
  platformGeneralSettings,
  aiSettings,
  companyAccessSettings,
  companyModuleAccess,
  companyAiUsageDaily,
  platformActivities,
} from "@/db/schema/platform.schema";
import {
  equipmentAssets,
  equipmentManualChunks,
  equipmentManuals,
  equipmentCategories,
  issueCategories,
  safetyReportingMasters,
  measuringPoints,
  meterCounters,
  kaizenCategories,
  locations,
  logAttachments,
  logTimelineEvents,
  operationalLogs,
} from "@/db/schema/operational.schema";
import { aiChatMessages, aiChatSessions } from "@/db/schema/ai.schema";

export const schema = {
  companyStatusEnum,
  moduleStatusEnum,
  userRoleEnum,
  userStatusEnum,
  companies,
  admins,
  adminLoginHistory,
  passwordResetOtps,
  modules,
  moduleFields,
  moduleTypes,
  moduleCategories,
  companyAccessSettings,
  companyModuleAccess,
  platformActivities,
  companyAiUsageDaily,
  platformGeneralSettings,
  aiSettings,
  locations,
  issueCategories,
  safetyReportingMasters,
  equipmentCategories,
  measuringPoints,
  meterCounters,
  kaizenCategories,
  equipmentAssets,
  equipmentManuals,
  equipmentManualChunks,
  operationalLogs,
  logAttachments,
  logTimelineEvents,
  aiChatSessions,
  aiChatMessages,
};

export type DatabaseSchema = typeof schema;
