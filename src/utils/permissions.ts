import type { ModulePermissionMap, PermissionLevel } from '../types/permissions'

export function normalizePermissionMap(raw: unknown): ModulePermissionMap {
  if (!raw || typeof raw !== 'object') return {}
  const out: ModulePermissionMap = {}
  for (const [mod, branches] of Object.entries(raw as Record<string, unknown>)) {
    if (!branches || typeof branches !== 'object') continue
    const bMap: Record<string, PermissionLevel> = {}
    for (const [branchKey, level] of Object.entries(branches as Record<string, unknown>)) {
      if (level === 'read' || level === 'write' || level === 'none') {
        bMap[branchKey] = level
      }
    }
    if (Object.keys(bMap).length) out[mod] = bMap
  }
  return out
}

function levelRank(level: PermissionLevel): number {
  if (level === 'write') return 2
  if (level === 'read') return 1
  return 0
}

export function effectiveModuleLevel(
  permissions: ModulePermissionMap | undefined,
  moduleKey: string,
  branchId: string | undefined,
  allBranchLiteral: 'all' = 'all',
): PermissionLevel {
  const mod = permissions?.[moduleKey]
  if (!mod) return 'none'

  const candidates: PermissionLevel[] = []
  if (branchId && mod[branchId]) candidates.push(mod[branchId])
  if (mod[allBranchLiteral]) candidates.push(mod[allBranchLiteral])

  if (!candidates.length) return 'none'
  return candidates.reduce((best, cur) => (levelRank(cur) > levelRank(best) ? cur : best), 'none' as PermissionLevel)
}

export function hasModuleAccess(
  permissions: ModulePermissionMap | undefined,
  moduleKey: string,
  branchId: string | undefined,
  required: 'read' | 'write',
): boolean {
  const level = effectiveModuleLevel(permissions, moduleKey, branchId)
  if (required === 'read') return level === 'read' || level === 'write'
  return level === 'write'
}
