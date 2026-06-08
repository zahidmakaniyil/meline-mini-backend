import mongoose, { Schema } from 'mongoose'

type QueryWithOptions = {
  getOptions?: () => { withDeleted?: boolean }
  where: (cond: Record<string, unknown>) => void
}

export function applyAuditFields(schema: Schema) {
  schema.add({
    created_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deleted_at: { type: Date, default: null },
    deleted_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    is_deleted: { type: Boolean, default: false, index: true },
  })

  schema.set('timestamps', { createdAt: 'created_at', updatedAt: 'updated_at' })

  const guard = function (this: QueryWithOptions) {
    if (!this.getOptions?.()?.withDeleted) {
      this.where({ is_deleted: { $ne: true } })
    }
  }

  ;(schema as unknown as { pre: (event: string, fn: () => void) => void }).pre('find', guard)
  ;(schema as unknown as { pre: (event: string, fn: () => void) => void }).pre('findOne', guard)
  ;(schema as unknown as { pre: (event: string, fn: () => void) => void }).pre('countDocuments', guard)
  ;(schema as unknown as { pre: (event: string, fn: () => void) => void }).pre('findOneAndUpdate', guard)
}

export function objectIdOrNull(id?: string) {
  if (!id) return null
  return new mongoose.Types.ObjectId(id)
}
