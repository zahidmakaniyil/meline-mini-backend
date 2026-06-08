import type { NextFunction, Request, Response } from 'express'

function branchIdFromRequest(req: Request): string | undefined {
  const q = req.query.branchId
  if (typeof q === 'string') return q
  const b = (req.body as { branchId?: string } | undefined)?.branchId
  if (typeof b === 'string') return b
  return undefined
}

export function branchGuard(req: Request, res: Response, next: NextFunction) {
  const user = req.user
  if (!user) return res.status(401).json({ message: 'Unauthorized' })

  if (user.role === 'super_admin') {
    const queryBranchId = branchIdFromRequest(req)
    if (queryBranchId) req.branchId = queryBranchId
    return next()
  }

  const assigned = req.assignedBranchIds ?? []
  const queryBranchId = branchIdFromRequest(req)

  if (queryBranchId) {
    if (!assigned.includes(queryBranchId)) {
      return res.status(403).json({ message: 'Forbidden branch' })
    }
    req.branchId = queryBranchId
    return next()
  }

  const fallback = user.branchId || assigned[0]
  if (!fallback) {
    return res.status(403).json({ message: 'Missing branch assignment' })
  }

  req.branchId = fallback
  return next()
}
