import { db } from "@/db";
import { platformActivities } from "@/db/schema";

type CreatePlatformActivityInput = {
  event: string;
  area: string;
  action: string;
  status: string;
  userDisplayName?: string;
  companyId?: string | null;
  companyNameSnapshot?: string | null;
  occurredAt?: Date;
};

export async function createPlatformActivity(input: CreatePlatformActivityInput) {
  const now = new Date();

  await db.insert(platformActivities).values({
    event: input.event,
    area: input.area,
    action: input.action,
    status: input.status,
    userDisplayName: input.userDisplayName ?? "Master Super",
    companyId: input.companyId ?? null,
    companyNameSnapshot: input.companyNameSnapshot ?? null,
    occurredAt: input.occurredAt ?? now,
    createdAt: now,
  });
}
