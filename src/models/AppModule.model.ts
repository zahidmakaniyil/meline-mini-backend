import mongoose, { Document, Schema } from 'mongoose'
import { applyAuditFields } from '../utils/mongooseAudit'
import type { AuditFields } from '../types/audit'

export interface IAppModule extends Document, AuditFields {
  key: string
  label: string
  description: string
  sortOrder: number
  isActive: boolean
}

const AppModuleSchema = new Schema<IAppModule>(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  {},
)

AppModuleSchema.index(
  { key: 1 },
  { unique: true, partialFilterExpression: { is_deleted: { $ne: true } } },
)

applyAuditFields(AppModuleSchema)

export default mongoose.model<IAppModule>('AppModule', AppModuleSchema)
