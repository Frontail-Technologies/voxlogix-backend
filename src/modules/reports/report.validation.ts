import { z } from "zod";

const dateValue = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date format.");

export const outputReportQuerySchema = z
  .object({
    fromDate: dateValue,
    toDate: dateValue,
    companyId: z.string().uuid().optional(),
  })
  .refine((value) => value.fromDate <= value.toDate, {
    message: "From Date must be before or equal to To Date.",
    path: ["fromDate"],
  });
