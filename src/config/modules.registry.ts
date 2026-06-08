/**
 * Default catalog rows seeded on startup (upsert by key). Runtime source of truth is Mongo `AppModule`.
 */
export type ModuleDefinition = {
  key: string
  label: string
  description?: string
  sortOrder: number
}

export const DEFAULT_APP_MODULES: ModuleDefinition[] = [
  { key: 'customers', label: 'Customers', sortOrder: 10 },
  { key: 'kids', label: 'Kids', sortOrder: 20 },
  { key: 'bookings', label: 'Bookings', sortOrder: 30 },
  { key: 'schedules', label: 'Schedules', sortOrder: 40 },
  { key: 'services', label: 'Services', sortOrder: 50 },
  { key: 'staffs', label: 'Staffs', sortOrder: 60 },
  { key: 'expenses', label: 'Expenses', sortOrder: 70 },
  { key: 'payments', label: 'Payments', sortOrder: 80 },
  { key: 'inventory', label: 'Inventory', sortOrder: 90 },
  { key: 'analytics', label: 'Analytics', sortOrder: 100 },
]

export function assertKnownModuleKeys(keys: string[], isKnown: (k: string) => boolean): void {
  for (const k of keys) {
    if (!isKnown(k)) throw new Error(`Unknown module: ${k}`)
  }
}
