import { Router } from "express";

import { requireAuth } from "@/middlewares/auth-placeholder.middleware";
import { requireRole } from "@/middlewares/role-placeholder.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { getNotifications, getUnreadCount, patchAllNotificationsRead, patchNotificationRead, postAdminNotification } from "@/modules/notifications/notification.controller";
import { notificationIdParamsSchema, sendAdminNotificationBodySchema } from "@/modules/notifications/notification.validation";
import { USER_ROLES } from "@/shared/constants";

const notificationsRouter = Router();
const readRoles = [USER_ROLES.EXECUTION, USER_ROLES.PLANNER, USER_ROLES.ADMIN, USER_ROLES.MASTER];

notificationsRouter.use(requireAuth);
notificationsRouter.get("/", requireRole(...readRoles), getNotifications);
notificationsRouter.get("/unread-count", requireRole(...readRoles), getUnreadCount);
notificationsRouter.patch("/read-all", requireRole(...readRoles), patchAllNotificationsRead);
notificationsRouter.patch("/:notificationId/read", requireRole(...readRoles), validate({ params: notificationIdParamsSchema }), patchNotificationRead);
notificationsRouter.post("/admin-send", requireRole(USER_ROLES.ADMIN), validate({ body: sendAdminNotificationBodySchema }), postAdminNotification);

export { notificationsRouter };
