import { z } from 'zod'
import { permissionsMapSchema } from './permission.validator'

export const createAdminUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).optional(),
  branchIds: z.array(z.string()).min(1),
  permissions: permissionsMapSchema.optional(),
})

export const updateAdminSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email().toLowerCase().optional(),
  password: z.string().min(8).optional(),
  isActive: z.boolean().optional(),
  branchIds: z.array(z.string()).min(1).optional(),
  permissions: permissionsMapSchema.optional(),
})

export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>
export type UpdateAdminInput = z.infer<typeof updateAdminSchema>

export const resetAdminPasswordSchema = z
  .object({
    newPassword: z.string().min(8),
    confirmNewPassword: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'New passwords do not match',
    path: ['confirmNewPassword'],
  })

export type ResetAdminPasswordInput = z.infer<typeof resetAdminPasswordSchema>
