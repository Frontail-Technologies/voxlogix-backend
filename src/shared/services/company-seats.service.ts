import { and, count, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { admins, companyAccessSettings } from "@/db/schema";
import { USER_ROLES, USER_STATUS } from "@/shared/constants";
import { AppError } from "@/shared/errors/app-error";
import { ERROR_CODES } from "@/shared/errors/error-codes";
import { HTTP_STATUS } from "@/shared/errors/http-status";

// Derive the transaction type from db.transaction so both db and tx are accepted.
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbOrTx = typeof db | DbTransaction;

export const SEAT_LIMIT_MESSAGE =
  "User limit reached. Please contact VoxLogiX to increase the company user limit.";

// Count ACTIVE company users excluding the platform-level MASTER role.
// MASTER users are never billed as company seats regardless of status.
export async function getActiveSeatCount(companyId: string, tx: DbOrTx = db): Promise<number> {
  const [row] = await tx
    .select({ activeSeatCount: count() })
    .from(admins)
    .where(
      and(
        eq(admins.companyId, companyId),
        eq(admins.status, USER_STATUS.ACTIVE),
        ne(admins.role, USER_ROLES.MASTER),
      ),
    );
  return row?.activeSeatCount ?? 0;
}

export async function getCompanySeatInfo(companyId: string): Promise<{
  activeCount: number;
  limit: number;
  available: number;
}> {
  const [settings] = await db
    .select({ userCreationLimit: companyAccessSettings.userCreationLimit })
    .from(companyAccessSettings)
    .where(eq(companyAccessSettings.companyId, companyId))
    .limit(1);

  const limit = settings?.userCreationLimit ?? 75;
  const activeCount = await getActiveSeatCount(companyId);

  return {
    activeCount,
    limit,
    available: Math.max(0, limit - activeCount),
  };
}

// Atomic seat-capacity guard. Must be called INSIDE a db.transaction() block.
//
// Acquires a row-level lock on the company_access_settings row (SELECT … FOR UPDATE)
// so concurrent callers for the same company queue up. After locking, it reads the
// current active seat count and throws SEAT_LIMIT_REACHED when the requested number
// of new seats would exceed the limit.
export async function assertSeatCapacity(
  companyId: string,
  seatsNeeded: number,
  tx: DbTransaction,
): Promise<void> {
  if (seatsNeeded <= 0) return;

  const [settings] = await tx
    .select({ userCreationLimit: companyAccessSettings.userCreationLimit })
    .from(companyAccessSettings)
    .where(eq(companyAccessSettings.companyId, companyId))
    .for("update")
    .limit(1);

  if (!settings) {
    throw new AppError({
      message: "Company access settings not found.",
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ERROR_CODES.NOT_FOUND,
    });
  }

  const activeCount = await getActiveSeatCount(companyId, tx);

  if (activeCount + seatsNeeded > settings.userCreationLimit) {
    throw new AppError({
      message: SEAT_LIMIT_MESSAGE,
      statusCode: HTTP_STATUS.CONFLICT,
      errorCode: ERROR_CODES.SEAT_LIMIT_REACHED,
    });
  }
}
