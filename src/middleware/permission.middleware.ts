import type { NextFunction, Request, Response } from 'express'
import { hasModuleAccess } from '../utils/permissions'

export function requireModule(moduleKey: string, level: 'read' | 'write') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role === 'super_admin') return next()

    const perms = req.principal?.permissions
    const branchId = req.branchId

    if (!hasModuleAccess(perms, moduleKey, branchId, level)) {
      return res.status(403).json({ message: 'Insufficient permissions for this module' })
    }
    return next()
  }
}
