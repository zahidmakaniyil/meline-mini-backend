export type PermissionLevel = 'none' | 'read' | 'write'

/** moduleKey -> branchId or 'all' -> level */
export type ModulePermissionMap = Record<string, Record<string, PermissionLevel>>
