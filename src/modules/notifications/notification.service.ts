import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { admins, inAppNotifications } from "@/db/schema";
import { NOTIFICATION_TYPES } from "@/modules/notifications/notification.domain";
import type { SendAdminNotificationInput } from "@/modules/notifications/notification.validation";
import { USER_ROLES, USER_STATUS } from "@/shared/constants";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

export async function listNotifications(companyId: string, userId: string, limit?: number) {
  const cappedLimit = Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  return db.select().from(inAppNotifications)
    .where(and(eq(inAppNotifications.companyId, companyId), eq(inAppNotifications.recipientUserId, userId)))
    .orderBy(desc(inAppNotifications.createdAt)).limit(cappedLimit);
}

export async function getUnreadNotificationCount(companyId: string, userId: string) {
  const [result] = await db.select({ count: count() }).from(inAppNotifications).where(and(
    eq(inAppNotifications.companyId, companyId),
    eq(inAppNotifications.recipientUserId, userId),
    isNull(inAppNotifications.readAt),
  ));
  return result.count;
}

export async function markNotificationRead(companyId: string, userId: string, notificationId: string) {
  const [updated] = await db.update(inAppNotifications).set({ readAt: new Date() }).where(and(
    eq(inAppNotifications.id, notificationId),
    eq(inAppNotifications.companyId, companyId),
    eq(inAppNotifications.recipientUserId, userId),
  )).returning();
  if (!updated) throw new AppError({ message: "Notification not found.", statusCode: HTTP_STATUS.NOT_FOUND, errorCode: ERROR_CODES.NOT_FOUND });
  return updated;
}

export async function markAllNotificationsRead(companyId: string, userId: string) {
  const updated = await db.update(inAppNotifications).set({ readAt: new Date() }).where(and(
    eq(inAppNotifications.companyId, companyId),
    eq(inAppNotifications.recipientUserId, userId),
    isNull(inAppNotifications.readAt),
  )).returning({ id: inAppNotifications.id });
  return { updated: updated.length };
}

export async function sendAdminNotification(companyId: string, createdByUserId: string, input: SendAdminNotificationInput) {
  const requestedIds = Array.from(new Set(input.recipientUserIds ?? []));
  const filters = [
    eq(admins.companyId, companyId),
    eq(admins.role, USER_ROLES.EXECUTION),
    eq(admins.status, USER_STATUS.ACTIVE),
  ];
  if (input.audience === "SELECTED") filters.push(inArray(admins.id, requestedIds));

  const recipients = await db.select({ id: admins.id }).from(admins).where(and(...filters));
  if (input.audience === "SELECTED" && recipients.length !== requestedIds.length) {
    throw new AppError({ message: "One or more selected Executors are unavailable.", statusCode: HTTP_STATUS.BAD_REQUEST, errorCode: ERROR_CODES.VALIDATION_ERROR });
  }
  if (recipients.length === 0) return { sent: 0 };

  await db.insert(inAppNotifications).values(recipients.map((recipient) => ({
    companyId,
    recipientUserId: recipient.id,
    createdByUserId,
    type: NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT,
    title: input.title,
    message: input.message,
  })));
  return { sent: recipients.length };
}
