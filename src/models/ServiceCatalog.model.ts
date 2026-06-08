import mongoose, { Document, Schema } from 'mongoose'
import { applyAuditFields } from '../utils/mongooseAudit'
import type { AuditFields } from '../types/audit'

export interface IServiceCatalog extends Document, AuditFields {
  key: string
  name: string
  description?: string
  sortOrder: number
  isActive: boolean
}

const ServiceCatalogSchema = new Schema<IServiceCatalog>(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  {},
)

applyAuditFields(ServiceCatalogSchema)

export default mongoose.model<IServiceCatalog>('ServiceCatalog', ServiceCatalogSchema)
