import mongoose from 'mongoose'

export interface AuditFields {
  created_at?: Date
  created_by?: mongoose.Types.ObjectId | null
  updated_at?: Date
  updated_by?: mongoose.Types.ObjectId | null
  deleted_at?: Date | null
  deleted_by?: mongoose.Types.ObjectId | null
  is_deleted?: boolean
}
