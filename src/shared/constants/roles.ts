export const USER_ROLES = {
  MASTER: "MASTER",
  ADMIN: "ADMIN",
  PLANNER: "PLANNER",
  EXECUTION: "EXECUTION",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
