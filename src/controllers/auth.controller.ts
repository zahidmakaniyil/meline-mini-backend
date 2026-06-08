import type { Request, Response } from 'express'
import { changePasswordSchema, changePrimaryBranchSchema, loginSchema, registerSchema } from '../validators/auth.validator'
import { HttpError } from '../utils/http'
import * as authService from '../services/auth.service'
import { decryptCookieValue, encryptCookieValue } from '../utils/cookieCrypto'
import UserModel from '../models/User.model'
import UserBranchAssignmentModel from '../models/UserBranchAssignment.model'
import * as moduleCatalog from '../services/moduleCatalog.service'
import { normalizePermissionMap } from '../utils/permissions'
import { toPublicUser } from '../services/auth.service'
import StaffTypeModel from '../models/StaffType.model'
import BranchModel from '../models/Branch.model'
import { decryptRequestPayload } from '../utils/requestCrypto'

function refreshCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ('none' as const) : ('lax' as const),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth/refresh',
  }
}

function accessCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ('none' as const) : ('lax' as const),
    maxAge: 15 * 60 * 1000,
    path: '/',
  }
}

function userCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ('none' as const) : ('lax' as const),
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  }
}

export async function register(req: Request, res: Response) {
  try {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: 'Invalid body', errors: parsed.error.flatten() })

    const { user, accessToken, refreshToken } = await authService.register(parsed.data)

    res.cookie('refreshToken', encryptCookieValue(refreshToken), refreshCookieOptions())
    res.cookie('accessToken', encryptCookieValue(accessToken), accessCookieOptions())
    res.cookie('meline_dashboard_user', encryptCookieValue(JSON.stringify(user)), userCookieOptions())
    return res.status(201).json({ user })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Register failed'
    const status = message === 'Email already in use' ? 409 : 400
    return res.status(status).json({ message })
  }
}

export async function login(req: Request, res: Response) {
  try {
    const maybeEncrypted = (req.body as { payload?: unknown } | undefined)?.payload
    const loginBody =
      typeof maybeEncrypted === 'string' ? decryptRequestPayload(maybeEncrypted) : (req.body as unknown)
    const parsed = loginSchema.safeParse(loginBody)
    if (!parsed.success) return res.status(400).json({ message: 'Invalid body', errors: parsed.error.flatten() })

    const { user, accessToken, refreshToken } = await authService.login(parsed.data)
    res.cookie('refreshToken', encryptCookieValue(refreshToken), refreshCookieOptions())
    res.cookie('accessToken', encryptCookieValue(accessToken), accessCookieOptions())
    res.cookie('meline_dashboard_user', encryptCookieValue(JSON.stringify(user)), userCookieOptions())
    return res.status(200).json({ user })
  } catch {
    return res.status(401).json({ message: 'Invalid credentials' })
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const encryptedRefresh = req.cookies?.refreshToken as string | undefined
    if (!encryptedRefresh) return res.status(401).json({ message: 'Missing refresh token' })
    const refreshToken = decryptCookieValue(encryptedRefresh)

    const { user, accessToken, refreshToken: newRefreshToken } = await authService.refresh({ refreshToken })
    res.cookie('refreshToken', encryptCookieValue(newRefreshToken), refreshCookieOptions())
    res.cookie('accessToken', encryptCookieValue(accessToken), accessCookieOptions())
    res.cookie('meline_dashboard_user', encryptCookieValue(JSON.stringify(user)), userCookieOptions())
    return res.status(200).json({ user })
  } catch {
    return res.status(401).json({ message: 'Invalid refresh token' })
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const encryptedRefresh = req.cookies?.refreshToken as string | undefined
    const refreshToken = encryptedRefresh ? decryptCookieValue(encryptedRefresh) : undefined
    await authService.logout({ refreshToken })
  } finally {
    res.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' })
    res.clearCookie('accessToken', { path: '/' })
    res.clearCookie('meline_dashboard_user', { path: '/' })
    return res.status(200).json({ message: 'Logged out' })
  }
}

export async function listMyBranches(req: Request, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' })

    if (req.user.role === 'super_admin') {
      const items = await BranchModel.find({})
        .select('name location phone email isActive')
        .sort({ name: 1 })
        .lean()
      return res.status(200).json({ items })
    }

    const ids = req.assignedBranchIds ?? []
    if (!ids.length) return res.status(200).json({ items: [] })

    const items = await BranchModel.find({ _id: { $in: ids } })
      .select('name location phone email isActive')
      .sort({ name: 1 })
      .lean()
    return res.status(200).json({ items })
  } catch {
    return res.status(500).json({ message: 'Failed to load branches' })
  }
}

export async function changePassword(req: Request, res: Response) {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ message: 'Unauthorized' })

    const parsed = changePasswordSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: 'Invalid body', errors: parsed.error.flatten() })

    await authService.changePassword({
      userId,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    })

    res.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' })
    res.clearCookie('accessToken', { path: '/' })
    res.clearCookie('meline_dashboard_user', { path: '/' })
    return res.status(200).json({ message: 'Password changed successfully' })
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json({ message: error.message })
    return res.status(500).json({ message: 'Failed to change password' })
  }
}

export async function changePrimaryBranch(req: Request, res: Response) {
  try {
    const userId = req.user?.userId
    const role = req.user?.role
    if (!userId || !role) return res.status(401).json({ message: 'Unauthorized' })

    const parsed = changePrimaryBranchSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: 'Invalid body', errors: parsed.error.flatten() })

    await authService.changePrimaryBranch({
      userId,
      branchId: parsed.data.branchId,
      role,
      assignedBranchIds: req.assignedBranchIds ?? [],
    })

    return res.status(200).json({ message: 'Primary branch updated successfully' })
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json({ message: error.message })
    return res.status(500).json({ message: 'Failed to update primary branch' })
  }
}

export async function me(req: Request, res: Response) {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ message: 'Unauthorized' })
    const user = await UserModel.findById(userId).select('name email role branchId staffTypeId permissions authVersion')
    if (!user) return res.status(404).json({ message: 'User not found' })

    const assignments = await UserBranchAssignmentModel.find({ userId: user._id }).select('branchId').lean()
    const assignedBranchIds = assignments.map((a) => String(a.branchId))

    let staffType: { id: string; key: string; name: string } | null = null
    if (user.staffTypeId) {
      const st = await StaffTypeModel.findById(user.staffTypeId).select('key name').lean()
      if (st && st._id) {
        staffType = { id: String(st._id), key: st.key, name: st.name }
      }
    }

    const permissions = normalizePermissionMap(user.permissions)
    const base = toPublicUser(user, assignedBranchIds)
    const modules = await moduleCatalog.listActiveForMeta()

    return res.status(200).json({
      user: {
        ...base,
        assignedBranchIds,
        permissions,
        staffType,
        authVersion: typeof user.authVersion === 'number' ? user.authVersion : 1,
        modules,
      },
    })
  } catch {
    return res.status(500).json({ message: 'Failed to load session user' })
  }
}
