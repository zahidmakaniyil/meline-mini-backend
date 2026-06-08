import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken } from '../config/jwt.config'
import { decryptCookieValue } from '../utils/cookieCrypto'
import UserModel from '../models/User.model'
import UserBranchAssignmentModel from '../models/UserBranchAssignment.model'
import { normalizePermissionMap } from '../utils/permissions'
import { normalizeUserRole } from '../utils/legacyRole'

export async function verifyToken(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization
    let token: string | undefined
    if (header?.startsWith('Bearer ')) {
      token = header.slice('Bearer '.length).trim()
    } else if (req.cookies?.accessToken) {
      token = decryptCookieValue(req.cookies.accessToken as string)
    }
    if (!token) return res.status(401).json({ message: 'Missing access token' })
    const payload = verifyAccessToken(token)

    const user = await UserModel.findById(payload.sub).select(
      'name email role branchId staffTypeId permissions authVersion isActive',
    )
    if (!user || !user.isActive) return res.status(401).json({ message: 'Invalid or expired access token' })

    const av = typeof user.authVersion === 'number' ? user.authVersion : 1
    const tokenAv = typeof payload.av === 'number' ? payload.av : -1
    if (tokenAv !== av) {
      return res.status(401).json({ message: 'Session outdated', code: 'AUTH_VERSION_STALE' })
    }

    const role = normalizeUserRole(String(user.role))

    const assignments = await UserBranchAssignmentModel.find({ userId: user._id }).select('branchId').lean()
    const assignedBranchIds = assignments.map((a) => String(a.branchId))

    const primaryBranch =
      (typeof payload.branchId === 'string' && payload.branchId) ||
      (user.branchId ? user.branchId.toString() : undefined) ||
      assignedBranchIds[0]

    req.user = {
      userId: user._id.toString(),
      role,
      branchId: primaryBranch,
    }
    req.assignedBranchIds = assignedBranchIds
    req.principal = {
      name: user.name,
      email: user.email,
      permissions: normalizePermissionMap(user.permissions),
      staffTypeId: user.staffTypeId ? user.staffTypeId.toString() : null,
    }

    return next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired access token' })
  }
}

export function requireRole(roles: Array<NonNullable<Request['user']>['role']>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.user?.role
    if (!role) return res.status(401).json({ message: 'Unauthorized' })
    if (!roles.includes(role)) return res.status(403).json({ message: 'Forbidden' })
    return next()
  }
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'super_admin') return res.status(403).json({ message: 'Forbidden' })
  return next()
}
