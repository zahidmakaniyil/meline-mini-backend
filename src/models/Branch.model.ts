import mongoose, { Document, Schema } from 'mongoose'
import { applyAuditFields } from '../utils/mongooseAudit'
import type { AuditFields } from '../types/audit'

export interface IBranch extends Document, AuditFields {
  name: string
  location: string
  phone: string
  email: string
  workingHours: {
    [key: string]: { open: string; close: string; isOff: boolean }
  }
  isActive: boolean
}

const BranchSchema = new Schema<IBranch>(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    workingHours: {
      monday: { open: String, close: String, isOff: { type: Boolean, default: false } },
      tuesday: { open: String, close: String, isOff: { type: Boolean, default: false } },
      wednesday: { open: String, close: String, isOff: { type: Boolean, default: false } },
      thursday: { open: String, close: String, isOff: { type: Boolean, default: false } },
      friday: { open: String, close: String, isOff: { type: Boolean, default: false } },
      saturday: { open: String, close: String, isOff: { type: Boolean, default: false } },
      sunday: { open: String, close: String, isOff: { type: Boolean, default: true } },
    },
    isActive: { type: Boolean, default: true },
  },
  {},
)

applyAuditFields(BranchSchema)

export default mongoose.model<IBranch>('Branch', BranchSchema)
