import { z } from 'zod'
import { isKnownModuleKey } from '../services/moduleCatalog.cache'

const level = z.enum(['none', 'read', 'write'])

export const permissionsMapSchema = z
  .record(z.string(), z.record(z.string(), level))
  .superRefine((val, ctx) => {
    for (const mod of Object.keys(val)) {
      if (!isKnownModuleKey(mod)) {
        ctx.addIssue({ code: 'custom', message: `Unknown module: ${mod}`, path: [mod] })
      }
    }
  })

export type PermissionsMapInput = z.infer<typeof permissionsMapSchema>
