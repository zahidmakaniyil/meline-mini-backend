import AppModuleModel from '../models/AppModule.model'

let cachedActiveKeys = new Set<string>()

export async function warmModuleKeyCache(): Promise<void> {
  const docs = await AppModuleModel.find({ is_deleted: { $ne: true }, isActive: true }).select('key').lean()
  cachedActiveKeys = new Set(docs.map((d) => String(d.key)))
}

/** Sync check for Zod; warm after DB connect and after every catalog mutation. */
export function isKnownModuleKey(key: string): boolean {
  return cachedActiveKeys.has(key)
}
