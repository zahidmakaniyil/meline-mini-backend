/**
 * One-time RBAC migration: legacy roles -> admin/staff, seed StaffTypes, branch assignments.
 * Run: npx ts-node-dev --transpile-only src/scripts/migrate-rbac.ts
 */
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import UserModel from '../models/User.model'
import StaffTypeModel from '../models/StaffType.model'
import UserBranchAssignmentModel from '../models/UserBranchAssignment.model'

dotenv.config()

async function seedStaffTypes() {
  const defaults = [
    { key: 'manager', name: 'Manager', sortOrder: 10 },
    { key: 'receptionist', name: 'Receptionist', sortOrder: 20 },
    { key: 'stylist', name: 'Stylist', sortOrder: 30 },
    { key: 'cashier', name: 'Cashier', sortOrder: 40 },
  ]
  for (const d of defaults) {
    await StaffTypeModel.updateOne(
      { key: d.key },
      { $setOnInsert: { name: d.name, sortOrder: d.sortOrder, isActive: true } },
      { upsert: true },
    )
  }
}

async function run() {
  const uri = process.env.MONGO_URI
  if (!uri) throw new Error('MONGO_URI missing')
  await mongoose.connect(uri)
  console.log('Connected')

  await seedStaffTypes()

  const typeByKey = async (key: string) => StaffTypeModel.findOne({ key }).lean()

  const users = await UserModel.find({})
  for (const u of users) {
    const r = u.role as string
    let newRole = r
    let staffTypeKey: string | null = null

    if (r === 'manager') {
      newRole = 'admin'
    } else if (r === 'receptionist') {
      newRole = 'staff'
      staffTypeKey = 'receptionist'
    } else if (r === 'staff') {
      newRole = 'staff'
      staffTypeKey = 'stylist'
    } else if (r === 'super_admin') {
      newRole = 'super_admin'
    }

    if (newRole !== r) {
      await UserModel.updateOne({ _id: u._id }, { $set: { role: newRole } })
      console.log(`User ${u.email}: role ${r} -> ${newRole}`)
    }

    if (staffTypeKey && newRole === 'staff') {
      const st = await typeByKey(staffTypeKey)
      if (st?._id) {
        await UserModel.updateOne({ _id: u._id }, { $set: { staffTypeId: st._id } })
      }
    }

    if (newRole !== 'super_admin' && u.branchId) {
      await UserBranchAssignmentModel.updateOne(
        { userId: u._id, branchId: u.branchId },
        { $setOnInsert: { userId: u._id, branchId: u.branchId } },
        { upsert: true },
      )
    }

    const permUpdate: Record<string, unknown> = {}
    if (!u.permissions || Object.keys(u.permissions as object).length === 0) {
      if (newRole === 'admin' || newRole === 'staff') {
        const branchKey = u.branchId?.toString()
        const perms =
          newRole === 'admin'
            ? {
                bookings: branchKey ? { [branchKey]: 'write' } : { all: 'write' },
                customers: branchKey ? { [branchKey]: 'write' } : { all: 'write' },
                staffs: branchKey ? { [branchKey]: 'write' } : { all: 'write' },
                services: branchKey ? { [branchKey]: 'write' } : { all: 'write' },
              }
            : {
                bookings: branchKey ? { [branchKey]: 'write' } : { all: 'write' },
                customers: branchKey ? { [branchKey]: 'read' } : { all: 'read' },
                staffs: branchKey ? { [branchKey]: 'read' } : { all: 'read' },
              }
        permUpdate.permissions = perms
      }
    }
    if (Object.keys(permUpdate).length) {
      await UserModel.updateOne({ _id: u._id }, { $set: permUpdate })
      console.log(`User ${u.email}: seeded permissions`)
    }

    await UserModel.updateOne({ _id: u._id }, { $set: { authVersion: (u.authVersion || 0) + 1 } })
  }

  console.log('Migration done')
  await mongoose.disconnect()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
