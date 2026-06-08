import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import UserModel, { IUser, UserRole } from '../models/User.model'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../config/jwt.config'
import { normalizeUserRole } from '../utils/legacyRole'
import UserBranchAssignmentModel from '../models/UserBranchAssignment.model'
import BranchModel from '../models/Branch.model'
import { HttpError } from '../utils/http'
import { objectIdOrNull } from '../utils/mongooseAudit'
import { revokeUserSessions } from './session.service'

export type PublicUser = {
  id: string
  name: string
  email: string
  role: UserRole
  branchId?: string
}

function primaryBranchId(user: IUser, assigned: string[]): string | undefined {
  return user.branchId ? user.branchId.toString() : assigned[0]
}

export function toPublicUser(user: IUser, assignedBranchIds: string[] = []): PublicUser {
  const role = normalizeUserRole(String(user.role))
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role,
    branchId: primaryBranchId(user, assignedBranchIds),
  }
}

async function assignedBranchesFor(userId: string): Promise<string[]> {
  const rows = await UserBranchAssignmentModel.find({ userId }).select('branchId').lean()
  return rows.map((r) => String(r.branchId))
}

function accessPayload(user: IUser, assigned: string[]) {
  const role = normalizeUserRole(String(user.role))
  const av = typeof user.authVersion === 'number' ? user.authVersion : 1
  return {
    sub: user._id.toString(),
    role,
    branchId: primaryBranchId(user, assigned),
    av,
  }
}

export async function register(params: {
  name: string
  email: string
  password: string
  role?: UserRole
  branchId?: string
}) {
  const existing = await UserModel.findOne({ email: params.email })
  if (existing) throw new Error('Email already in use')

  const requestedRole = params.role ?? 'admin'
  if (requestedRole === 'super_admin') {
    const existsSa = await UserModel.exists({ role: 'super_admin' })
    if (existsSa) throw new Error('Super admin already exists')
  }

  const passwordHash = await bcrypt.hash(params.password, 10)
  const role: UserRole = requestedRole

  const user = await UserModel.create({
    name: params.name,
    email: params.email,
    passwordHash,
    role,
    branchId: params.branchId ? new mongoose.Types.ObjectId(params.branchId) : undefined,
    permissions: {},
    authVersion: 1,
  })

  if (params.branchId && role !== 'super_admin') {
    await UserBranchAssignmentModel.create({
      userId: user._id,
      branchId: new mongoose.Types.ObjectId(params.branchId),
    })
  }

  const assigned = await assignedBranchesFor(user._id.toString())
  const accessToken = signAccessToken(accessPayload(user, assigned))
  const refreshToken = signRefreshToken({ sub: user._id.toString() })

  user.refreshToken = refreshToken
  await user.save()

  return { user: toPublicUser(user, assigned), accessToken, refreshToken }
}

export async function login(params: { email: string; password: string }) {
  const user = await UserModel.findOne({ email: params.email })
  if (!user || !user.isActive) throw new Error('Invalid credentials')

  const ok = await bcrypt.compare(params.password, user.passwordHash)
  if (!ok) throw new Error('Invalid credentials')

  const assigned = await assignedBranchesFor(user._id.toString())
  const accessToken = signAccessToken(accessPayload(user, assigned))
  const refreshToken = signRefreshToken({ sub: user._id.toString() })

  user.refreshToken = refreshToken
  await user.save()

  return { user: toPublicUser(user, assigned), accessToken, refreshToken }
}

export async function refresh(params: { refreshToken: string }) {
  const payload = verifyRefreshToken(params.refreshToken)
  const userId = payload.sub
  if (!userId) throw new Error('Invalid refresh token')

  const user = await UserModel.findById(userId)
  if (!user || !user.isActive) throw new Error('Invalid refresh token')
  if (!user.refreshToken || user.refreshToken !== params.refreshToken) throw new Error('Invalid refresh token')

  const assigned = await assignedBranchesFor(user._id.toString())
  const accessToken = signAccessToken(accessPayload(user, assigned))

  const newRefreshToken = signRefreshToken({ sub: user._id.toString() })
  user.refreshToken = newRefreshToken
  await user.save()

  return { user: toPublicUser(user, assigned), accessToken, refreshToken: newRefreshToken }
}

export async function changePassword(params: { userId: string; currentPassword: string; newPassword: string }) {
  const user = await UserModel.findById(params.userId)
  if (!user || !user.isActive) throw new HttpError(401, 'Unauthorized')

  const ok = await bcrypt.compare(params.currentPassword, user.passwordHash)
  if (!ok) throw new HttpError(400, 'Current password is incorrect')

  user.passwordHash = await bcrypt.hash(params.newPassword, 10)
  user.updated_by = objectIdOrNull(params.userId)
  await user.save()
  await revokeUserSessions(params.userId)
}

export async function changePrimaryBranch(params: {
  userId: string
  branchId: string
  role: UserRole
  assignedBranchIds: string[]
}) {
  if (!mongoose.isValidObjectId(params.branchId)) {
    throw new HttpError(400, 'Invalid branch id')
  }

  const branch = await BranchModel.findOne({ _id: params.branchId, isActive: { $ne: false } })
    .select('_id')
    .lean()
  if (!branch) {
    throw new HttpError(400, 'Invalid or inactive branch')
  }

  if (params.role !== 'super_admin' && !params.assignedBranchIds.includes(params.branchId)) {
    throw new HttpError(400, 'Branch is not assigned to user')
  }

  const user = await UserModel.findById(params.userId)
  if (!user || !user.isActive) throw new HttpError(401, 'Unauthorized')

  user.branchId = new mongoose.Types.ObjectId(params.branchId)
  user.updated_by = objectIdOrNull(params.userId)
  await user.save()
}

export async function logout(params: { refreshToken?: string }) {
  if (!params.refreshToken) return

  try {
    const payload = verifyRefreshToken(params.refreshToken)
    const userId = payload.sub
    if (!userId) return

    await UserModel.updateOne({ _id: userId, refreshToken: params.refreshToken }, { $unset: { refreshToken: '' } })
  } catch {
    // ignore invalid token on logout
  }
}
