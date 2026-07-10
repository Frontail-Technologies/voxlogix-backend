import type { z } from "zod";

import type {
  createAdminBodySchema,
  listAdminsQuerySchema,
  resetAdminPasswordBodySchema,
  updateAdminBodySchema,
} from "./admin.validation";

export type ListAdminsInput = z.infer<typeof listAdminsQuerySchema>;
export type CreateAdminInput = z.infer<typeof createAdminBodySchema>;
export type UpdateAdminInput = z.infer<typeof updateAdminBodySchema>;
export type ResetPasswordInput = z.infer<typeof resetAdminPasswordBodySchema>;

export type AdminListRow = {
  id: string;
  fullName: string;
  initials: string;
  username: string;
  email: string;
  phone: string;
  status: string;
  joinedOn: Date;
  lastLoginAt: Date | null;
  companyId: string;
  companyName: string;
};
