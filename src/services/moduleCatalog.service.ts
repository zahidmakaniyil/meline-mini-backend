import mongoose from 'mongoose'
import AppModuleModel, { type IAppModule } from '../models/AppModule.model'
import UserModel from '../models/User.model'
import BranchModel from '../models/Branch.model'
import { DEFAULT_APP_MODULES } from '../config/modules.registry'
import { HttpError } from '../utils/http'
import { normalizePagination, type PaginatedResult } from '../utils/pagination'
import { objectIdOrNull } from '../utils/mongooseAudit'
import { warmModuleKeyCache } from './moduleCatalog.cache'
import type { CreateAppModuleInput, UpdateAppModuleInput } from '../validators/appModule.validator'
import * as lifecycleImpact from './lifecycleImpact.service'

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function slugifyModuleKey(label: string): string {
  const normalized = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return normalized || 'module'
}

async function nextModuleSortOrder(): Promise<number> {
  const last = await AppModuleModel.findOne({ is_deleted: { $ne: true } }).select('sortOrder').sort({ sortOrder: -1 }).lean()
  const currentMax = typeof last?.sortOrder === 'number' ? last.sortOrder : 0
  return currentMax + 10
}

async function resolveUniqueModuleKey(base: string): Promise<string> {
  let key = base
  let idx = 2
  while (await AppModuleModel.findOne({ key, is_deleted: { $ne: true } }).select('_id').lean()) {
    key = `${base}_${idx}`
    idx += 1
  }
  return key
}

export async function seedDefaultAppModules(): Promise<void> {
  for (const def of DEFAULT_APP_MODULES) {
    await AppModuleModel.updateOne(
      { key: def.key, is_deleted: { $ne: true } },
      {
        $setOnInsert: {
          key: def.key,
          label: def.label,
          description: def.description ?? '',
          sortOrder: def.sortOrder,
          isActive: true,
          is_deleted: false,
        },
      },
      { upsert: true },
    )
  }
}

export type ModuleMetaRow = {
  key: string
  label: string
  description?: string
}

export async function listActiveForMeta(): Promise<ModuleMetaRow[]> {
  const items = await AppModuleModel.find({ is_deleted: { $ne: true }, isActive: true })
    .sort({ sortOrder: 1, label: 1 })
    .lean()

  return items.map((m) => ({
    key: m.key,
    label: m.label,
    description: m.description || undefined,
  }))
}

function toLeanDoc(m: IAppModule) {
  const o = m.toObject()

  return {
    _id: String(o._id),
    key: o.key,
    label: o.label,
    description: o.description ?? '',
    sortOrder: o.sortOrder,
    isActive: o.isActive,
    created_at: o.created_at,
    updated_at: o.updated_at,
  }
}


type ModuleUserSummary = {
  id: string
  name: string
  isActive: boolean
  type?: string
  permission: string
}

function summarizeModulePermission(
  permissionBranchMap: Record<string, string> | undefined,
  branchNameById: Map<string, string>,
): string {
  if (!permissionBranchMap) return 'none'

  const parts = Object.entries(permissionBranchMap)
    .filter(([, level]) => level === 'read' || level === 'write')
    .map(([scope, level]) => {
      if (scope === 'all') return `All:${level}`
      const branchName = branchNameById.get(scope)
      return `${branchName ?? 'Branch'}:${level}`
    })

  if (!parts.length) return 'none'
  return parts.join(', ')
}

async function usersByModule(moduleKey: string): Promise<{ adminUsers: ModuleUserSummary[]; staffUsers: ModuleUserSummary[] }> {
  const users = await UserModel.find({
    role: { $in: ['admin', 'staff'] },
    [`permissions.${moduleKey}`]: { $exists: true },
  })
    .select('name role permissions staffTypeId')
    .populate('staffTypeId', 'name')

  const adminUsers: ModuleUserSummary[] = []
  const staffUsers: ModuleUserSummary[] = []

  const branchIds = new Set<string>()
  for (const u of users) {
    const raw = u.permissions as Record<string, Record<string, string>> | undefined
    const modulePermission = raw?.[moduleKey]
    if (!modulePermission) continue
    for (const scope of Object.keys(modulePermission)) {
      if (scope !== 'all' && mongoose.isValidObjectId(scope)) branchIds.add(scope)
    }
  }

  const branchNameById = new Map<string, string>()
  if (branchIds.size) {
    const branches = await BranchModel.find({ _id: { $in: Array.from(branchIds) } }).select('name').lean()
    for (const b of branches) {
      branchNameById.set(String(b._id), b.name)
    }
  }

  for (const u of users) {
    const raw = u.permissions as Record<string, Record<string, string>> | undefined
    const permission = summarizeModulePermission(raw?.[moduleKey], branchNameById)
    if (permission === 'none') continue

    if (u.role === 'admin') {
      adminUsers.push({ id: String(u._id), name: u.name, isActive: u.isActive !== false, permission })
      continue
    }

    const staffType = (u.staffTypeId as unknown as { name?: string } | null)?.name
    staffUsers.push({ id: String(u._id), name: u.name, isActive: u.isActive !== false, type: staffType || '-', permission })
  }

  adminUsers.sort((a, b) => a.name.localeCompare(b.name))
  staffUsers.sort((a, b) => a.name.localeCompare(b.name))

  return { adminUsers, staffUsers }
}

export async function listAppModules(params: {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  includeInactive?: boolean
}): Promise<PaginatedResult<ReturnType<typeof toLeanDoc>>> {
  const { page, pageSize, skip } = normalizePagination(params)
  const sortBy =
    params.sortBy && ['sortOrder', 'label', 'key', 'created_at'].includes(params.sortBy) ? params.sortBy : 'sortOrder'
  const sortOrder = params.sortOrder === 'desc' ? -1 : 1

  const query: Record<string, unknown> = {}
  if (!params.includeInactive) query.isActive = true
  if (params.search?.trim()) {
    const rx = new RegExp(escapeRegex(params.search.trim()), 'i')
    query.$or = [{ key: rx }, { label: rx }]
  }

  const [items, total] = await Promise.all([
    AppModuleModel.find(query).sort({ [sortBy]: sortOrder, label: 1 })
      .skip(skip)
      .limit(pageSize),
    AppModuleModel.countDocuments(query),
  ])

  return {
    items: items.map((m) => toLeanDoc(m)),
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
}

export async function getAppModuleById(id: string) {
  const m = await AppModuleModel.findById(id)
  if (!m) throw new HttpError(404, 'Module not found')

  const base = toLeanDoc(m)
  const users = await usersByModule(base.key)
  return { ...base, ...users }
}

export async function createAppModule(input: CreateAppModuleInput, actorId?: string) {
  const baseKey = input.key ?? slugifyModuleKey(input.label)
  const key = await resolveUniqueModuleKey(baseKey)
  const sortOrder = typeof input.sortOrder === 'number' ? input.sortOrder : await nextModuleSortOrder()

  const doc = await AppModuleModel.create({
    key,
    label: input.label,
    description: input.description ?? '',
    sortOrder,
    isActive: input.isActive ?? true,
    created_by: objectIdOrNull(actorId),
    updated_by: objectIdOrNull(actorId),
  })
  await warmModuleKeyCache()
  const full = await AppModuleModel.findById(doc._id)
  return full ? toLeanDoc(full) : toLeanDoc(doc)
}

export async function updateAppModule(id: string, input: UpdateAppModuleInput, actorId?: string) {
  const m = await AppModuleModel.findById(id)
  if (!m) throw new HttpError(404, 'Module not found')
  const wasActive = m.isActive !== false

  if (input.label !== undefined) m.label = input.label
  if (input.description !== undefined) m.description = input.description
  if (input.sortOrder !== undefined) m.sortOrder = input.sortOrder
  if (input.isActive !== undefined) m.isActive = input.isActive

  m.updated_by = objectIdOrNull(actorId)
  await m.save()
  if (wasActive && input.isActive === false) {
    await lifecycleImpact.onModuleDisabled(m.key, actorId)
  }
  await warmModuleKeyCache()
  const full = await AppModuleModel.findById(id)
  return full ? toLeanDoc(full) : toLeanDoc(m)
}

export async function softDeleteAppModule(id: string, actorId?: string) {
  const existing = await AppModuleModel.findById(id).select('key')
  if (!existing) throw new HttpError(404, 'Module not found')
  const m = await AppModuleModel.findByIdAndUpdate(
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
  if (!m) throw new HttpError(404, 'Module not found')

  await lifecycleImpact.onModuleDisabled(existing.key, actorId)
  await warmModuleKeyCache()
  return toLeanDoc(m)
}
