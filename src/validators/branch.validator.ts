import { z } from 'zod'

const daySchema = z.object({
  open: z.string().min(1),
  close: z.string().min(1),
  isOff: z.boolean().optional(),
})

const branchCoreSchema = z
  .object({
  name: z.string().trim().min(1),
  location: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: z.string().trim().email().toLowerCase(),
  workingHours: z
    .object({
      monday: daySchema,
      tuesday: daySchema,
      wednesday: daySchema,
      thursday: daySchema,
      friday: daySchema,
      saturday: daySchema,
      sunday: daySchema,
    })
    .optional(),
    isActive: z.boolean().optional(),
  })
  .strict()

export const createBranchSchema = branchCoreSchema

export type CreateBranchInput = z.infer<typeof createBranchSchema>

const fullBranchUpdateSchema = branchCoreSchema.partial().refine(
  (data) => {
    const touchedCore =
      data.name !== undefined || data.location !== undefined || data.phone !== undefined || data.email !== undefined
    if (!touchedCore) return true
    return Boolean(data.name?.trim() && data.location?.trim() && data.phone?.trim() && data.email?.trim())
  },
  {
    message: 'name, location, phone and email are required when updating branch details',
    path: ['name'],
  },
)

const statusOnlyUpdateSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict()

export const updateBranchSchema = z.union([fullBranchUpdateSchema, statusOnlyUpdateSchema])
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>
