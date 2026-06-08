import mongoose, { Document, Schema } from 'mongoose'
import { applyAuditFields } from '../utils/mongooseAudit'
import type { AuditFields } from '../types/audit'
import type { ModulePermissionMap } from '../types/permissions'

export type UserRole = 'super_admin' | 'admin' | 'staff'

export interface IUser extends Document, AuditFields {
  name: string
  email: string
  passwordHash: string
  role: UserRole
  branchId?: mongoose.Types.ObjectId
  staffTypeId?: mongoose.Types.ObjectId | null
  permissions: ModulePermissionMap
  authVersion: number
  refreshToken?: string
  isActive: boolean
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'staff'],
      required: true,
    },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    staffTypeId: { type: Schema.Types.ObjectId, ref: 'StaffType', default: null },
    permissions: { type: Schema.Types.Mixed, default: {} },
    authVersion: { type: Number, default: 1 },
    refreshToken: { type: String },
    isActive: { type: Boolean, default: true },
  },
  {},
)

applyAuditFields(UserSchema)

export default mongoose.model<IUser>('User', UserSchema)
