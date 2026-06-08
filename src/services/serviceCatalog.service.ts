import mongoose from 'mongoose'
import ServiceCatalogModel from '../models/ServiceCatalog.model'
import type { CreateServiceCatalogInput, UpdateServiceCatalogInput } from '../validators/serviceCatalog.validator'
import { HttpError } from '../utils/http'
import { objectIdOrNull } from '../utils/mongooseAudit'
import { normalizePagination, type ListQueryParams, type PaginatedResult } from '../utils/pagination'
import BranchModel from '../models/Branch.model'
import ServiceBranchAssignmentModel from '../models/ServiceBranchAssignment.model'
import * as lifecycleImpact from './lifecycleImpact.service'

const DEFAULT_SERVICE_CATALOG_ITEMS: Array<{ name: string; description: string }> = [
  { name: 'Kids Haircut', description: 'Classic haircut for children with a comfortable salon experience.' },
  { name: 'Kids Hair Wash & Blow Dry', description: 'Gentle wash and light blow dry for kids.' },
  { name: 'Kids Braiding', description: 'Neat and stylish braids suitable for kids.' },
  { name: 'Kids Hair Styling', description: 'Special occasion styling for birthdays and events.' },
  { name: 'Kids Manicure', description: 'Simple and safe manicure designed for children.' },
  { name: 'Kids Pedicure', description: 'Gentle pedicure and basic nail care for kids.' },
  { name: 'Kids Nail Art', description: 'Fun and colorful kid-friendly nail art.' },
  { name: 'Kids Party Package', description: 'Combined grooming services for celebrations and group bookings.' },
]

function slugifyServiceKey(name: string): string {
  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return normalized || 'service'
}

async function nextServiceSortOrder(): Promise<number> {
  const last = await ServiceCatalogModel.findOne({ is_deleted: { $ne: true } }).select('sortOrder').sort({ sortOrder: -1 }).lean()
  const currentMax = typeof last?.sortOrder === 'number' ? last.sortOrder : 0
  return currentMax + 10
}

async function resolveUniqueServiceKey(base: string): Promise<string> {
  let key = base
  let idx = 2
  while (await ServiceCatalogModel.findOne({ key, is_deleted: { $ne: true } }).select('_id').lean()) {
    key = `${base}_${idx}`
    idx += 1
  }
  return key
}

export async function seedDefaultServiceCatalog() {
  const count = await ServiceCatalogModel.countDocuments({ is_deleted: { $ne: true } })
  if (count > 0) return

  const activeBranches = await BranchModel.find({ isActive: { $ne: false } }).select('_id').lean()
  const activeBranchIds = activeBranches.map((b) => String((b as any)._id))

  let sortOrder = 10
  for (const item of DEFAULT_SERVICE_CATALOG_ITEMS) {
    const key = await resolveUniqueServiceKey(slugifyServiceKey(item.name))
    const doc = await ServiceCatalogModel.create({
      key,
      name: item.name,
      description: item.description,
      sortOrder,
      isActive: true,
    })

    if (activeBranchIds.length) {
      await ServiceBranchAssignmentModel.insertMany(
        activeBranchIds.map((bid) => ({
          serviceId: doc._id,
          branchId: new mongoose.Types.ObjectId(bid),
          created_by: null,
          updated_by: null,
        })),
        { ordered: false },
      )
    }
    sortOrder += 10
  }
}

export async function listServiceCatalog(
  params: (ListQueryParams & { includeInactive?: boolean }) | undefined,
): Promise<PaginatedResult<{ _id: string; key: string; name: string; description?: string; sortOrder: number; isActive: boolean }>> {
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
    const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    query.$or = [{ name: rx }, { key: rx }]
  }

  const allowedSort = new Set(['name', 'key', 'sortOrder', 'created_at', 'updated_at', 'isActive'])
  const sortBy = sortByRaw && allowedSort.has(sortByRaw) ? sortByRaw : 'sortOrder'

  const [docs, total] = await Promise.all([
    ServiceCatalogModel.find(query)
      .sort({ [sortBy]: sortOrder, name: 1 })
      .skip(skip)
      .limit(pageSizeResolved)
      .lean(),
    ServiceCatalogModel.countDocuments(query),
  ])

  return {
    items: docs.map((d) => ({
      _id: String((d as any)._id),
      key: (d as any).key,
      name: (d as any).name,
      description: (d as any).description ?? undefined,
      sortOrder: (d as any).sortOrder,
      isActive: (d as any).isActive !== false,
    })),
    pagination: {
      page: pageResolved,
      pageSize: pageSizeResolved,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSizeResolved)),
    },
  }
}

export async function createServiceCatalogItem(input: CreateServiceCatalogInput, actorId?: string) {
  const key = await resolveUniqueServiceKey(input.key ?? slugifyServiceKey(input.name))
  const sortOrder = typeof input.sortOrder === 'number' ? input.sortOrder : await nextServiceSortOrder()
  const doc = await ServiceCatalogModel.create({
    ...input,
    key,
    sortOrder,
    isActive: input.isActive ?? true,
    created_by: objectIdOrNull(actorId),
    updated_by: objectIdOrNull(actorId),
  })

  const branchIds = await resolveServiceBranchIds(input.branchIds)
  if (branchIds.length) {
    await ServiceBranchAssignmentModel.insertMany(
      branchIds.map((bid) => ({
        serviceId: new mongoose.Types.ObjectId(doc._id),
        branchId: new mongoose.Types.ObjectId(bid),
        created_by: objectIdOrNull(actorId),
        updated_by: objectIdOrNull(actorId),
      })),
      { ordered: false },
    )
  }

  return doc
}

export async function updateServiceCatalogItem(id: string, input: UpdateServiceCatalogInput, actorId?: string) {
  const before = await ServiceCatalogModel.findById(id).select('isActive')
  if (!before) throw new HttpError(404, 'Service not found')
  if (input.key) {
    const clash = await ServiceCatalogModel.findOne({ key: input.key, _id: { $ne: id } })
    if (clash) throw new HttpError(409, 'Service key already exists')
  }
  const doc = await ServiceCatalogModel.findByIdAndUpdate(
    id,
    { ...input, updated_by: objectIdOrNull(actorId) },
    { new: true },
  )
  if (!doc) throw new HttpError(404, 'Service not found')
  if (before.isActive !== false && input.isActive === false) {
    await lifecycleImpact.onServiceDisabled(id)
  }

  if (input.branchIds) {
    const branchIds = await resolveServiceBranchIds(input.branchIds)
    await ServiceBranchAssignmentModel.deleteMany({ serviceId: doc._id })
    if (branchIds.length) {
      await ServiceBranchAssignmentModel.insertMany(
        branchIds.map((bid) => ({
          serviceId: new mongoose.Types.ObjectId(doc._id),
          branchId: new mongoose.Types.ObjectId(bid),
          created_by: objectIdOrNull(actorId),
          updated_by: objectIdOrNull(actorId),
        })),
        { ordered: false },
      )
    }
  }
  return doc
}

async function resolveServiceBranchIds(branchIds?: string[]) {
  // If omitted, default to all active branches. If provided (even empty), respect it.
  if (branchIds === undefined) {
    const active = await BranchModel.find({ isActive: { $ne: false } }).select('_id').lean()
    return active.map((b) => String((b as any)._id))
  }
  if (!branchIds.length) return []
  return [...new Set(branchIds.map((b) => String(b)))]
}

export async function softDeleteServiceCatalogItem(id: string, actorId?: string) {
  const doc = await ServiceCatalogModel.findByIdAndUpdate(
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
  if (!doc) throw new HttpError(404, 'Service not found')
  await lifecycleImpact.onServiceDisabled(id)
  return doc
}
