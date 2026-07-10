import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { companies } from "@/db/schema";
import type { ListCompaniesInput } from "@/modules/companies/company.types";
import { buildPagination } from "@/shared/helpers/pagination";

function buildCompaniesFilter({
  search,
  status,
}: Omit<ListCompaniesInput, "page" | "limit">) {
  const filters: SQL<unknown>[] = [];

  if (search) {
    filters.push(
      or(
        ilike(companies.name, `%${search}%`),
        ilike(companies.ownerName, `%${search}%`),
        ilike(companies.ownerEmail, `%${search}%`),
      )!,
    );
  }

  if (status) {
    filters.push(eq(companies.status, status as typeof companies.$inferSelect.status));
  }

  if (!filters.length) {
    return undefined;
  }

  return and(...filters);
}

export async function listCompanies(input: ListCompaniesInput) {
  const where = buildCompaniesFilter(input);

  const [{ totalItems }] = await db
    .select({ totalItems: count() })
    .from(companies)
    .where(where);

  const pagination = buildPagination({
    page: input.page,
    limit: input.limit,
    totalItems,
  });

  const items = await db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      logo: companies.logo,
      ownerName: companies.ownerName,
      ownerEmail: companies.ownerEmail,
      ownerPhone: companies.ownerPhone,
      businessType: companies.businessType,
      plan: companies.plan,
      status: companies.status,
      createdAt: companies.createdAt,
      updatedAt: companies.updatedAt,
    })
    .from(companies)
    .where(where)
    .orderBy(asc(companies.name))
    .limit(pagination.limit)
    .offset(pagination.offset);

  return {
    items,
    pagination,
  };
}

export async function listCompanyOptions() {
  return db
    .select({
      id: companies.id,
      name: companies.name,
      status: companies.status,
      plan: companies.plan,
    })
    .from(companies)
    .orderBy(asc(companies.name));
}

export async function getCompanyById(companyId: string) {
  const [company] = await db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      logo: companies.logo,
      ownerName: companies.ownerName,
      ownerEmail: companies.ownerEmail,
      ownerPhone: companies.ownerPhone,
      businessType: companies.businessType,
      plan: companies.plan,
      status: companies.status,
      createdAt: companies.createdAt,
      updatedAt: companies.updatedAt,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  return company ?? null;
}
