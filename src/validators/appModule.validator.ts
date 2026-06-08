import { z } from 'zod'

const keyRegex = /^[a-z][a-z0-9_]*$/

export const createAppModuleSchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(keyRegex, 'Use lowercase letters, numbers, underscores; start with a letter')
    .optional(),
  label: z.string().trim().min(1),
  description: z.string().trim().optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const updateAppModuleSchema = z.object({
  label: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
})

export type CreateAppModuleInput = z.infer<typeof createAppModuleSchema>
export type UpdateAppModuleInput = z.infer<typeof updateAppModuleSchema>
