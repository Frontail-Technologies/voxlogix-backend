import { z } from "zod";

export const notificationIdParamsSchema = z.object({ notificationId: z.string().uuid() });

export const sendAdminNotificationBodySchema = z.object({
  audience: z.enum(["SELECTED", "ALL"]),
  recipientUserIds: z.array(z.string().uuid()).max(100).optional(),
  title: z.string().trim().min(2).max(180),
  message: z.string().trim().min(2).max(2000),
}).superRefine((value, context) => {
  if (value.audience === "SELECTED" && !value.recipientUserIds?.length) {
    context.addIssue({ code: "custom", path: ["recipientUserIds"], message: "Select at least one Executor." });
  }
});

export type SendAdminNotificationInput = z.infer<typeof sendAdminNotificationBodySchema>;
