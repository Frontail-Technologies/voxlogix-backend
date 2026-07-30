import { eq, or } from "drizzle-orm";

import { db, postgresClient } from "@/db";
import { admins, companies } from "@/db/schema";
import { USER_ROLES, USER_STATUS } from "@/shared/constants";
import { hashPassword } from "@/shared/security/password";
import { ensureDefaultModuleSchemas } from "@/shared/services/default-module-schemas.service";
import { ensureAiSettings, ensureCompanyAccessSettings } from "@/shared/services/platform-defaults.service";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required to seed the Master account.`);
  }
  return value;
}

function initials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

async function ensurePlatformCompany(masterEmail: string, masterPhone: string) {
  const slug = "voxlogix-platform";
  const [existing] = await db.select().from(companies).where(eq(companies.slug, slug)).limit(1);
  if (existing) return existing;

  const now = new Date();
  const [created] = await db
    .insert(companies)
    .values({
      name: "VoxLogiX Platform",
      slug,
      logo: "VX",
      ownerName: "VoxLogiX Master",
      ownerEmail: masterEmail,
      ownerPhone: masterPhone,
      businessType: "Platform Operations",
      plan: "Platform",
      status: "ACTIVE",
      startDate: now,
      notes: "Internal platform company used for Master role access.",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

async function ensureMasterUser(companyId: string) {
  const email = requireEnv("MASTER_EMAIL").toLowerCase();
  const username = requireEnv("MASTER_USERNAME").toLowerCase();
  const password = requireEnv("MASTER_PASSWORD");
  const fullName = process.env.MASTER_NAME?.trim() || "VoxLogiX Master";
  const phone = process.env.MASTER_PHONE?.trim() || "+910000000000";

  const [existing] = await db
    .select()
    .from(admins)
    .where(or(eq(admins.email, email), eq(admins.username, username)))
    .limit(1);

  if (existing) {
    await db
      .update(admins)
      .set({ role: USER_ROLES.MASTER, companyId, status: USER_STATUS.ACTIVE, updatedAt: new Date() })
      .where(eq(admins.id, existing.id));
    return { email, created: false };
  }

  const now = new Date();
  const passwordHash = await hashPassword(password);
  await db.insert(admins).values({
    companyId,
    fullName,
    initials: initials(fullName),
    username,
    email,
    phone,
    role: USER_ROLES.MASTER,
    status: USER_STATUS.ACTIVE,
    passwordHash,
    requirePasswordReset: true,
    joinedOn: now,
    createdAt: now,
    updatedAt: now,
  });

  return { email, created: true };
}

export async function runSeed() {
  const masterEmail = requireEnv("MASTER_EMAIL").toLowerCase();
  const masterPhone = process.env.MASTER_PHONE?.trim() || "+910000000000";
  const platformCompany = await ensurePlatformCompany(masterEmail, masterPhone);
  await ensureCompanyAccessSettings(platformCompany.id);
  await ensureAiSettings();
  await ensureDefaultModuleSchemas();
  const master = await ensureMasterUser(platformCompany.id);

  console.log("Seed complete.");
  console.log(`Platform company: ${platformCompany.name}`);
  console.log(`Master login: ${master.email}`);
  console.log(master.created ? "Master user created." : "Master user already existed; role/status refreshed.");
}

if (require.main === module) {
  runSeed()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await postgresClient.end();
    });
}
