import type { PaginationInput, PaginationMeta } from "@/shared/types/pagination.types";

export function buildPagination({
  page = 1,
  limit = 20,
  totalItems = 0,
}: PaginationInput): PaginationMeta {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  const totalPages = Math.max(1, Math.ceil(totalItems / safeLimit));
  const offset = (safePage - 1) * safeLimit;

  return {
    page: safePage,
    limit: safeLimit,
    offset,
    totalItems,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPreviousPage: safePage > 1,
  };
}
