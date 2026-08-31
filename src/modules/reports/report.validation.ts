import { z } from "zod";

const dateValue = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date format.");

const MAX_REPORT_RANGE_DAYS = 730;

export const outputReportQuerySchema = z
  .object({
    fromDate: dateValue,
    toDate: dateValue,
    companyId: z.string().uuid().optional(),
  })
  .refine((value) => value.fromDate <= value.toDate, {
    message: "From Date must be before or equal to To Date.",
    path: ["fromDate"],
  })
  .refine(
    (value) => {
      const days =
        (new Date(value.toDate).getTime() -
          new Date(value.fromDate).getTime()) /
        (1000 * 60 * 60 * 24);
      return days <= MAX_REPORT_RANGE_DAYS;
    },
    {
      message: `Date range cannot exceed ${MAX_REPORT_RANGE_DAYS} days.`,
      path: ["toDate"],
    },
  );
