import type { AppJwtRole } from '../config/jwt.config'
import type { ModulePermissionMap } from './permissions'

export type AuthUser = {
  userId: string
  role: AppJwtRole
  branchId?: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
      branchId?: string
      assignedBranchIds?: string[]
      principal?: {
        name: string
        email: string
        permissions: ModulePermissionMap
        staffTypeId: string | null
      }
    }
  }
}

export {}
