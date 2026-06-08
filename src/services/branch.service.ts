import BranchModel from '../models/Branch.model'
import type { IBranch } from '../models/Branch.model'
import { HttpError } from '../utils/http'
import type { CreateBranchInput, UpdateBranchInput } from '../validators/branch.validator'
import { normalizePagination, type PaginatedResult } from '../utils/pagination'
import { objectIdOrNull } from '../utils/mongooseAudit'
import * as lifecycleImpact from './lifecycleImpact.service'

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function createBranch(input: CreateBranchInput, actorId?: string) {
  const branch = await BranchModel.create({
    ...input,
    created_by: objectIdOrNull(actorId),
    updated_by: objectIdOrNull(actorId),
  })
  return branch
}

export async function listBranches(params: {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  isActive?: boolean
}): Promise<PaginatedResult<IBranch>> {
  const { page, pageSize, skip } = normalizePagination(params)
  const sortBy = params.sortBy && ['name', 'location', 'email', 'created_at'].includes(params.sortBy) ? params.sortBy : 'created_at'
  const sortOrder = params.sortOrder === 'asc' ? 1 : -1

  const query: Record<string, unknown> = {}
  if (params.search?.trim()) {
    const searchRegex = new RegExp(escapeRegex(params.search.trim()), 'i')
    query.$or = [{ name: searchRegex }, { phone: searchRegex }, { email: searchRegex }]
  }
  if (typeof params.isActive === 'boolean') query.isActive = params.isActive

  const [items, total] = await Promise.all([
    BranchModel.find(query)
      .populate('created_by', 'name')
      .populate('updated_by', 'name')
      .populate('deleted_by', 'name')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(pageSize),
    BranchModel.countDocuments(query),
  ])

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
}

export async function getBranchById(id: string) {
  const branch = await BranchModel.findById(id)
  if (!branch) throw new HttpError(404, 'Branch not found')
  return branch
}

export async function updateBranch(id: string, input: UpdateBranchInput, actorId?: string) {
  const before = await BranchModel.findById(id).select('isActive')
  if (!before) throw new HttpError(404, 'Branch not found')

  const branch = await BranchModel.findByIdAndUpdate(id, { ...input, updated_by: objectIdOrNull(actorId) }, { new: true })
  if (!branch) throw new HttpError(404, 'Branch not found')
  if (before.isActive !== false && input.isActive === false) {
    await lifecycleImpact.onBranchDisabled(id, actorId)
  }
  return branch
}

export async function softDeleteBranch(id: string, actorId?: string) {
  const branch = await BranchModel.findByIdAndUpdate(
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
  if (!branch) throw new HttpError(404, 'Branch not found')
  await lifecycleImpact.onBranchDisabled(id, actorId)
  return branch
}
