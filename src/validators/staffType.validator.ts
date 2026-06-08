import { z } from 'zod'

export const createStaffTypeSchema = z.object({
  key: z.string().trim().min(1).toLowerCase().optional(),
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const updateStaffTypeSchema = createStaffTypeSchema.partial()

export type CreateStaffTypeInput = z.infer<typeof createStaffTypeSchema>
export type UpdateStaffTypeInput = z.infer<typeof updateStaffTypeSchema>
