import mongoose from 'mongoose'
import UserModel from '../models/User.model'
import UserBranchAssignmentModel from '../models/UserBranchAssignment.model'
import ServiceBranchAssignmentModel from '../models/ServiceBranchAssignment.model'
import { objectIdOrNull } from '../utils/mongooseAudit'
import type { ModulePermissionMap } from '../types/permissions'

function stripBranchScopeFromPermissions(
  permissions: ModulePermissionMap | undefined,
  branchId: string,
) {
  if (!permissions) return {}
  const next: ModulePermissionMap = {}
  for (const [moduleKey, branchMap] of Object.entries(permissions)) {
    const cleaned: Record<string, 'none' | 'read' | 'write'> = {}
    for (const [scope, level] of Object.entries(branchMap ?? {})) {
      if (scope === branchId) continue
      cleaned[scope] = level
    }
    if (Object.keys(cleaned).length) next[moduleKey] = cleaned
  }
  return next
}

export async function onBranchDisabled(branchId: string, actorId?: string) {
  const branchObjectId = new mongoose.Types.ObjectId(branchId)
  const assignments = await UserBranchAssignmentModel.find({ branchId: branchObjectId }).select('userId').lean()
  const userIds = [...new Set(assignments.map((a) => String(a.userId)))]

  await UserBranchAssignmentModel.deleteMany({ branchId: branchObjectId })
  await ServiceBranchAssignmentModel.deleteMany({ branchId: branchObjectId })

  for (const userId of userIds) {
    const user = await UserModel.findById(userId)
    if (!user) continue
    const nextPermissions = stripBranchScopeFromPermissions(user.permissions as ModulePermissionMap | undefined, branchId)
    user.permissions = nextPermissions

    const remaining = await UserBranchAssignmentModel.find({ userId: user._id }).select('branchId').lean()
    const nextPrimary = remaining[0]?.branchId
    user.branchId = nextPrimary ? new mongoose.Types.ObjectId(nextPrimary) : undefined
    user.updated_by = objectIdOrNull(actorId)
    await user.save()
  }
}

export async function onModuleDisabled(moduleKey: string, actorId?: string) {
  const users = await UserModel.find({ [`permissions.${moduleKey}`]: { $exists: true } })
  for (const user of users) {
    const permissions = (user.permissions ?? {}) as ModulePermissionMap
    if (!(moduleKey in permissions)) continue
    const nextPermissions = { ...permissions }
    delete nextPermissions[moduleKey]
    user.permissions = nextPermissions
    user.updated_by = objectIdOrNull(actorId)
    await user.save()
  }
}

export async function onServiceDisabled(serviceId: string) {
  await ServiceBranchAssignmentModel.deleteMany({ serviceId: new mongoose.Types.ObjectId(serviceId) })
}

export async function onAdminDisabled(userId: string, actorId?: string) {
  const user = await UserModel.findById(userId)
  if (!user) return
  user.permissions = {}
  user.updated_by = objectIdOrNull(actorId)
  await user.save()
}

