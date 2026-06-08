import { z } from 'zod'

export const registerSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8),
  role: z.enum(['super_admin', 'admin', 'staff']).optional(),
  branchId: z.string().trim().min(1).optional(),
})

export type RegisterInput = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1),
})

export type LoginInput = z.infer<typeof loginSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
    confirmNewPassword: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'New passwords do not match',
    path: ['confirmNewPassword'],
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

export const changePrimaryBranchSchema = z.object({
  branchId: z.string().trim().min(1),
})

export type ChangePrimaryBranchInput = z.infer<typeof changePrimaryBranchSchema>
