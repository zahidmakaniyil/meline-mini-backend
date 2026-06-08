import type { UserRole } from '../models/User.model'

/** Normalize DB strings from pre-migration documents. */
export function normalizeUserRole(role: string): UserRole {
  if (role === 'manager') return 'admin'
  if (role === 'receptionist') return 'staff'
  if (role === 'super_admin' || role === 'admin' || role === 'staff') return role
  return 'staff'
}
