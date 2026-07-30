import { z } from "zod";

import { COMPANY_STATUS } from "@/shared/constants";
import { paginationQuerySchema } from "@/shared/validators/pagination.validation";

const companyStatusValues = Object.values(COMPANY_STATUS) as [string, ...string[]];

const companyFormSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  logo: z.string().trim().max(8).optional(),
  logoUrl: z.string().trim().url().max(2000).nullable().optional(),
  logoKey: z.string().trim().max(2000).nullable().optional(),
  ownerName: z.string().trim().min(2).max(160),
  ownerEmail: z.string().trim().email().max(255),
  ownerPhone: z.string().trim().min(6).max(32),
  businessType: z.string().trim().min(2).max(120),
  address: z.string().trim().max(1000).optional(),
  planType: z.string().trim().min(2).max(80),
  status: z.enum(companyStatusValues),
  startDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  notes: z.string().trim().max(4000).optional(),
});

export const listCompaniesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  status: z.enum(companyStatusValues).optional(),
});

export const companyIdParamsSchema = z.object({
  companyId: z.string().uuid(),
});

export const createCompanyBodySchema = companyFormSchema;

export const updateCompanyBodySchema = companyFormSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const updateCompanyAccessBodySchema = z
  .object({
    voiceLoggingEnabled: z.boolean().optional(),
    aiStructuredExtractionEnabled: z.boolean().optional(),
    imageUploadEnabled: z.boolean().optional(),
    enabledModuleIds: z.array(z.string().uuid()).optional(),
    reportsEnabled: z.boolean().optional(),
    exportEnabled: z.boolean().optional(),
    userCreationLimit: z.number().int().min(1).max(100000).optional(),
    aiUsageLimitMinutes: z.number().int().min(0).max(1000000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });


