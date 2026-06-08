import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import UserModel from '../models/User.model'
import UserBranchAssignmentModel from '../models/UserBranchAssignment.model'
import ServiceCatalogModel from '../models/ServiceCatalog.model'
import ServiceBranchAssignmentModel from '../models/ServiceBranchAssignment.model'
import BranchModel from '../models/Branch.model'
import { HttpError } from '../utils/http'
import { normalizePermissionMap } from '../utils/permissions'
import { revokeUserSessions } from './session.service'
import { normalizePagination, type PaginatedResult } from '../utils/pagination'
import type { CreateAdminUserInput, UpdateAdminInput } from '../validators/superAdmin.validator'
import { objectIdOrNull } from '../utils/mongooseAudit'
import * as lifecycleImpact from './lifecycleImpact.service'

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function ensureObjectId(id: string, label: string) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, `Invalid ${label}`)
  return new mongoose.Types.ObjectId(id)
}

async function validateActiveBranchIds(branchIds: string[]): Promise<string[]> {
  const unique = [...new Set(branchIds.map((id) => String(id).trim()).filter(Boolean))]
  if (!unique.length) throw new HttpError(400, 'At least one branch is required')

  const invalid = unique.find((id) => !mongoose.isValidObjectId(id))
  if (invalid) throw new HttpError(400, `Invalid branch id: ${invalid}`)

  const docs = await BranchModel.find({ _id: { $in: unique }, isActive: { $ne: false } }).select('_id').lean()
  const validSet = new Set(docs.map((d) => String((d as any)._id)))
  const missing = unique.filter((id) => !validSet.has(id))
  if (missing.length) throw new HttpError(400, `Invalid or inactive branches: ${missing.join(', ')}`)

  return unique
}

function assertPermissionBranchScopes(
  permissions: ReturnType<typeof normalizePermissionMap>,
  allowedBranchIds: string[],
) {
  const allowed = new Set(allowedBranchIds)
  for (const [moduleKey, branchMap] of Object.entries(permissions ?? {})) {
    for (const branchId of Object.keys(branchMap ?? {})) {
      if (!allowed.has(branchId)) {
        throw new HttpError(400, `Permission scope branch not assigned: ${moduleKey}.${branchId}`)
      }
    }
  }
}

export async function createAdminUser(input: CreateAdminUserInput, actorId?: string) {
  const existing = await UserModel.findOne({ email: input.email })
  if (existing) throw new HttpError(409, 'Email already in use')

  const branchIds = await validateActiveBranchIds(input.branchIds)
  const password = input.password?.trim() || 'Abc@1234'
  const passwordHash = await bcrypt.hash(password, 10)
  const permissions = normalizePermissionMap(input.permissions ?? {})
  assertPermissionBranchScopes(permissions, branchIds)
  const primaryBranch = new mongoose.Types.ObjectId(branchIds[0])

  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    passwordHash,
    role: 'admin',
    branchId: primaryBranch,
    isActive: true,
    permissions,
    authVersion: 1,
    created_by: objectIdOrNull(actorId),
    updated_by: objectIdOrNull(actorId),
  })

  for (const bid of branchIds) {
    await UserBranchAssignmentModel.updateOne(
      { userId: user._id, branchId: new mongoose.Types.ObjectId(bid) },
      {
        $setOnInsert: {
          userId: user._id,
          branchId: new mongoose.Types.ObjectId(bid),
          created_by: objectIdOrNull(actorId),
          updated_by: objectIdOrNull(actorId),
        },
      },
      { upsert: true },
    )
  }
  return user
}

async function replaceBranchAssignments(userId: string, branchIds: string[], actorId?: string) {
  await UserBranchAssignmentModel.deleteMany({ userId })
  for (const bid of branchIds) {
    await UserBranchAssignmentModel.create({
      userId: new mongoose.Types.ObjectId(userId),
      branchId: new mongoose.Types.ObjectId(bid),
      created_by: objectIdOrNull(actorId),
      updated_by: objectIdOrNull(actorId),
    })
  }
}

async function toAdminRow(userId: string) {
  const user = await UserModel.findById(userId).select('name email role isActive permissions branchId created_at updated_at')
  if (!user) throw new HttpError(404, 'User not found')
  const assignments = await UserBranchAssignmentModel.find({ userId: user._id }).select('branchId').lean()
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive !== false,
    branchId: user.branchId ? String(user.branchId) : undefined,
    branchIds: assignments.map((a) => String(a.branchId)),
    permissions: normalizePermissionMap(user.permissions),
    created_at: user.created_at,
    updated_at: user.updated_at,
  }
}

export async function listAdmins(params: {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}): Promise<PaginatedResult<Awaited<ReturnType<typeof toAdminRow>>>> {
  const { page, pageSize, skip } = normalizePagination(params)
  const sortBy = params.sortBy && ['name', 'email', 'created_at'].includes(params.sortBy) ? params.sortBy : 'created_at'
  const sortOrder = params.sortOrder === 'asc' ? 1 : -1
  const query: Record<string, unknown> = { role: 'admin' }
  if (params.search?.trim()) {
    const rx = new RegExp(escapeRegex(params.search.trim()), 'i')
    query.$or = [{ name: rx }, { email: rx }]
  }

  const [rows, total] = await Promise.all([
    UserModel.find(query).sort({ [sortBy]: sortOrder }).skip(skip).limit(pageSize).select('_id'),
    UserModel.countDocuments(query),
  ])
  const items = await Promise.all(rows.map((r) => toAdminRow(String(r._id))))
  return {
    items,
    pagination: { page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
  }
}

export async function getAdminById(adminId: string) {
  if (!mongoose.isValidObjectId(adminId)) throw new HttpError(400, 'Invalid admin id')
  return toAdminRow(adminId)
}

export async function updateAdmin(adminId: string, input: UpdateAdminInput, actorId?: string) {
  if (!mongoose.isValidObjectId(adminId)) throw new HttpError(400, 'Invalid admin id')
  const user = await UserModel.findById(adminId)
  if (!user) throw new HttpError(404, 'User not found')
  if (user.role !== 'admin') throw new HttpError(400, 'Target is not an admin')

  if (input.email) {
    const clash = await UserModel.findOne({ email: input.email, _id: { $ne: adminId } })
    if (clash) throw new HttpError(409, 'Email already in use')
    user.email = input.email
  }
  if (input.name) user.name = input.name
  const nextBranchIds = input.branchIds?.length
    ? await validateActiveBranchIds(input.branchIds)
    : (await UserBranchAssignmentModel.find({ userId: adminId }).select('branchId').lean()).map((a) => String(a.branchId))

  if (input.permissions) {
    const normalizedPermissions = normalizePermissionMap(input.permissions)
    assertPermissionBranchScopes(normalizedPermissions, nextBranchIds)
    user.permissions = normalizedPermissions
  }
  if (typeof input.isActive === 'boolean') user.isActive = input.isActive
  if (input.password) user.passwordHash = await bcrypt.hash(input.password, 10)
  if (nextBranchIds.length) {
    user.branchId = new mongoose.Types.ObjectId(nextBranchIds[0])
  }
  user.updated_by = objectIdOrNull(actorId)
  await user.save()
  if (input.isActive === false) {
    await lifecycleImpact.onAdminDisabled(adminId, actorId)
  }
  if (input.branchIds?.length) await replaceBranchAssignments(adminId, nextBranchIds, actorId)
  await revokeUserSessions(adminId)
  return toAdminRow(adminId)
}

export async function resetAdminPassword(adminId: string, password: string, actorId?: string) {
  if (!mongoose.isValidObjectId(adminId)) throw new HttpError(400, 'Invalid admin id')
  const user = await UserModel.findById(adminId)
  if (!user) throw new HttpError(404, 'User not found')
  if (user.role !== 'admin') throw new HttpError(400, 'Target is not an admin')

  user.passwordHash = await bcrypt.hash(password, 10)
  user.updated_by = objectIdOrNull(actorId)
  await user.save()
  await revokeUserSessions(adminId)
  return { id: adminId }
}

export async function deactivateAdmin(adminId: string, actorId?: string) {
  if (!mongoose.isValidObjectId(adminId)) throw new HttpError(400, 'Invalid admin id')
  const user = await UserModel.findById(adminId)
  if (!user) throw new HttpError(404, 'User not found')
  if (user.role !== 'admin') throw new HttpError(400, 'Target is not an admin')
  user.isActive = false
  user.is_deleted = true
  user.deleted_at = new Date()
  user.deleted_by = objectIdOrNull(actorId)
  user.updated_by = objectIdOrNull(actorId)
  await user.save()
  await lifecycleImpact.onAdminDisabled(adminId, actorId)
  await revokeUserSessions(adminId)
  return {
    id: adminId,
    isDeleted: true,
  }
}

export async function listBranchUsers(branchId: string) {
  const branchObjectId = ensureObjectId(branchId, 'branch id')
  const assignments = await UserBranchAssignmentModel.find({ branchId: branchObjectId }).select('userId').lean()
  const userIds = assignments.map((a) => a.userId)
  if (!userIds.length) {
    return { admins: [], staffs: [] as Array<{ id: string; name: string; email: string; isActive: boolean; staffType?: string }> }
  }

  const users = await UserModel.find({ _id: { $in: userIds }, role: { $in: ['admin', 'staff'] } })
    .select('name email role isActive staffTypeId')
    .populate('staffTypeId', 'name')
    .lean()

  const admins: Array<{ id: string; name: string; email: string; isActive: boolean }> = []
  const staffs: Array<{ id: string; name: string; email: string; isActive: boolean; staffType?: string }> = []

  for (const user of users) {
    const base = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      isActive: user.isActive !== false,
    }
    if (user.role === 'admin') {
      admins.push(base)
    } else if (user.role === 'staff') {
      const staffType =
        user.staffTypeId && typeof user.staffTypeId === 'object' && 'name' in user.staffTypeId
          ? String(user.staffTypeId.name ?? '')
          : undefined
      staffs.push({ ...base, staffType })
    }
  }

  admins.sort((a, b) => a.name.localeCompare(b.name))
  staffs.sort((a, b) => a.name.localeCompare(b.name))

  return { admins, staffs }
}

export async function listBranchServices(branchId: string) {
  const branchObjectId = ensureObjectId(branchId, 'branch id')
  const assignments = await ServiceBranchAssignmentModel.find({ branchId: branchObjectId }).select('serviceId').lean()
  const serviceIds = assignments.map((a) => a.serviceId).filter(Boolean)
  if (!serviceIds.length) return { services: [] as Array<{ id: string; name: string; description?: string; isActive: boolean }> }

  const services = await ServiceCatalogModel.find({ _id: { $in: serviceIds } }).select('name description isActive').lean()
  const mapped = services.map((s) => ({
    id: String((s as any)._id),
    name: (s as any).name,
    description: (s as any).description ?? undefined,
    isActive: (s as any).isActive !== false,
  }))
  mapped.sort((a, b) => a.name.localeCompare(b.name))
  return { services: mapped }
}

export async function listServiceBranches(serviceId: string) {
  const serviceObjectId = ensureObjectId(serviceId, 'service id')
  const assignments = await ServiceBranchAssignmentModel.find({ serviceId: serviceObjectId }).select('branchId').lean()
  const branchIds = assignments.map((a) => a.branchId).filter(Boolean)
  if (!branchIds.length) return { branches: [] as Array<{ id: string; name: string; isActive: boolean }> }

  const branches = await BranchModel.find({ _id: { $in: branchIds } }).select('name isActive').lean()
  const mapped = branches.map((b) => ({
    id: String((b as any)._id),
    name: (b as any).name,
    isActive: (b as any).isActive !== false,
  }))
  mapped.sort((a, b) => a.name.localeCompare(b.name))
  return { branches: mapped }
}
