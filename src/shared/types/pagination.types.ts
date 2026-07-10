export type PaginationInput = {
  page?: number;
  limit?: number;
  totalItems?: number;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  offset: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};
