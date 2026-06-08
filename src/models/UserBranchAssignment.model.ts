import mongoose, { Document, Schema } from 'mongoose'
import { applyAuditFields } from '../utils/mongooseAudit'
import type { AuditFields } from '../types/audit'

export interface IUserBranchAssignment extends Document, AuditFields {
  userId: mongoose.Types.ObjectId
  branchId: mongoose.Types.ObjectId
}

const UserBranchAssignmentSchema = new Schema<IUserBranchAssignment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  },
  {},
)

applyAuditFields(UserBranchAssignmentSchema)

UserBranchAssignmentSchema.index({ userId: 1, branchId: 1 }, { unique: true })

export default mongoose.model<IUserBranchAssignment>('UserBranchAssignment', UserBranchAssignmentSchema)
