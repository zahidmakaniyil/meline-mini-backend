export type ListQueryParams = {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
}

export type PaginationMeta = {
  page: number
  pageSize: number
  total: number
  pageCount: number
}

export type PaginatedResult<T> = {
  items: T[]
  pagination: PaginationMeta
}

export function normalizePagination(params: ListQueryParams) {
  const page = params.page && params.page > 0 ? params.page : 1
  const pageSize = params.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, 100) : 10
  const skip = (page - 1) * pageSize
  return { page, pageSize, skip }
}
