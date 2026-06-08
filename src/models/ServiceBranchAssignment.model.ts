import mongoose, { Document, Schema } from 'mongoose'
import { applyAuditFields } from '../utils/mongooseAudit'
import type { AuditFields } from '../types/audit'

export interface IServiceBranchAssignment extends Document, AuditFields {
  serviceId: mongoose.Types.ObjectId
  branchId: mongoose.Types.ObjectId
}

const ServiceBranchAssignmentSchema = new Schema<IServiceBranchAssignment>(
  {
    serviceId: { type: Schema.Types.ObjectId, ref: 'ServiceCatalog', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  },
  {},
)

applyAuditFields(ServiceBranchAssignmentSchema)

ServiceBranchAssignmentSchema.index({ serviceId: 1, branchId: 1 }, { unique: true })

export default mongoose.model<IServiceBranchAssignment>('ServiceBranchAssignment', ServiceBranchAssignmentSchema)

