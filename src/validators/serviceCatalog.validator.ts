import { z } from 'zod'

export const createServiceCatalogSchema = z.object({
  key: z.string().trim().min(1).toLowerCase().optional(),
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  branchIds: z.array(z.string().min(1)).optional(),
})

export const updateServiceCatalogSchema = createServiceCatalogSchema.partial()

export type CreateServiceCatalogInput = z.infer<typeof createServiceCatalogSchema>
export type UpdateServiceCatalogInput = z.infer<typeof updateServiceCatalogSchema>
