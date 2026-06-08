import StaffTypeModel from '../models/StaffType.model'
import type { IStaffType } from '../models/StaffType.model'
import type { CreateStaffTypeInput, UpdateStaffTypeInput } from '../validators/staffType.validator'
import { HttpError } from '../utils/http'
import { objectIdOrNull } from '../utils/mongooseAudit'
import UserModel from '../models/User.model'
import { normalizePagination, type ListQueryParams, type PaginatedResult } from '../utils/pagination'

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const ALLOWED_SORT_FIELDS = new Set(['name', 'key', 'sortOrder', 'created_at', 'updated_at', 'isActive'])

function slugifyStaffTypeKey(name: string): string {
  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return normalized || 'staff_type'
}

async function nextStaffTypeSortOrder(): Promise<number> {
  const last = await StaffTypeModel.findOne({ is_deleted: { $ne: true } }).select('sortOrder').sort({ sortOrder: -1 }).lean()
  const currentMax = typeof last?.sortOrder === 'number' ? last.sortOrder : 0
  return currentMax + 10
}

async function resolveUniqueStaffTypeKey(base: string): Promise<string> {
  let key = base
  let idx = 2
  while (await StaffTypeModel.findOne({ key, is_deleted: { $ne: true } }).select('_id').lean()) {
    key = `${base}_${idx}`
    idx += 1
  }
  return key
}

export async function listStaffTypes(
  params: (ListQueryParams & { includeInactive?: boolean }) | undefined,
): Promise<PaginatedResult<Pick<IStaffType, '_id' | 'key' | 'name' | 'description' | 'sortOrder' | 'isActive'>>> {
  const page = params?.page
  const pageSize = params?.pageSize
  const search = params?.search
  const sortByRaw = params?.sortBy
  const sortOrder = params?.sortOrder === 'desc' ? -1 : 1
  const includeInactive = params?.includeInactive === true

  const { page: pageResolved, pageSize: pageSizeResolved, skip } = normalizePagination({ page, pageSize })

  const query: Record<string, unknown> = {}
  if (!includeInactive) query.isActive = true

  if (search?.trim()) {
    const rx = new RegExp(escapeRegex(search.trim()), 'i')
    query.$or = [{ name: rx }, { key: rx }]
  }

  const sortBy = sortByRaw && ALLOWED_SORT_FIELDS.has(sortByRaw) ? sortByRaw : 'sortOrder'

  const [items, total] = await Promise.all([
    StaffTypeModel.find(query).sort({ [sortBy]: sortOrder, name: 1 }).skip(skip).limit(pageSizeResolved).lean(),
    StaffTypeModel.countDocuments(query),
  ])

  return {
    items,
    pagination: {
      page: pageResolved,
      pageSize: pageSizeResolved,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSizeResolved)),
    },
  }
}

export async function createStaffType(input: CreateStaffTypeInput, actorId?: string) {
  const key = await resolveUniqueStaffTypeKey(input.key ?? slugifyStaffTypeKey(input.name))
  const sortOrder = typeof input.sortOrder === 'number' ? input.sortOrder : await nextStaffTypeSortOrder()
  return StaffTypeModel.create({
    ...input,
    key,
    sortOrder,
    isActive: input.isActive ?? true,
    created_by: objectIdOrNull(actorId),
    updated_by: objectIdOrNull(actorId),
  })
}

export async function updateStaffType(id: string, input: UpdateStaffTypeInput, actorId?: string) {
  if (input.key) {
    const clash = await StaffTypeModel.findOne({ key: input.key, _id: { $ne: id } })
    if (clash) throw new HttpError(409, 'Staff type key already exists')
  }
  const doc = await StaffTypeModel.findByIdAndUpdate(
    id,
    { ...input, updated_by: objectIdOrNull(actorId) },
    { new: true },
  )
  if (!doc) throw new HttpError(404, 'Staff type not found')
  return doc
}

export async function softDeleteStaffType(id: string, actorId?: string) {
  const inUse = await UserModel.exists({ staffTypeId: id })
  if (inUse) throw new HttpError(409, 'Cannot delete staff type assigned to users')

  const doc = await StaffTypeModel.findByIdAndUpdate(
    id,
    {
      isActive: false,
      is_deleted: true,
      deleted_at: new Date(),
      deleted_by: objectIdOrNull(actorId),
      updated_by: objectIdOrNull(actorId),
    },
    { new: true },
  )
  if (!doc) throw new HttpError(404, 'Staff type not found')
  return doc
}
