import type { Request, Response } from 'express'
import { createAdminUserSchema, resetAdminPasswordSchema, updateAdminSchema } from '../validators/superAdmin.validator'
import * as superAdminService from '../services/superAdmin.service'
import { sendError } from '../utils/http'

export async function createAdmin(req: Request, res: Response) {
  try {
    const body = createAdminUserSchema.parse(req.body)
    const user = await superAdminService.createAdminUser(body, req.user?.userId)
    return res.status(201).json({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export async function listAdmins(req: Request, res: Response) {
  try {
    const page = typeof req.query.page === 'string' ? Number(req.query.page) : undefined
    const pageSize = typeof req.query.pageSize === 'string' ? Number(req.query.pageSize) : undefined
    const search = typeof req.query.search === 'string' ? req.query.search : undefined
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : undefined
    const sortOrder = req.query.sortOrder === 'asc' || req.query.sortOrder === 'desc' ? req.query.sortOrder : undefined
    const result = await superAdminService.listAdmins({ page, pageSize, search, sortBy, sortOrder })
    return res.status(200).json(result)
  } catch (error) {
    return sendError(res, error)
  }
}

export async function getAdmin(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const row = await superAdminService.getAdminById(id)
    return res.status(200).json(row)
  } catch (error) {
    return sendError(res, error)
  }
}

export async function patchAdmin(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const body = updateAdminSchema.parse(req.body)
    const row = await superAdminService.updateAdmin(id, body, req.user?.userId)
    return res.status(200).json(row)
  } catch (error) {
    return sendError(res, error)
  }
}

export async function resetAdminPassword(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const body = resetAdminPasswordSchema.parse(req.body)
    const row = await superAdminService.resetAdminPassword(id, body.newPassword, req.user?.userId)
    return res.status(200).json({ ...row, message: 'Password reset successfully' })
  } catch (error) {
    return sendError(res, error)
  }
}

export async function removeAdmin(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const row = await superAdminService.deactivateAdmin(id, req.user?.userId)
    return res.status(200).json(row)
  } catch (error) {
    return sendError(res, error)
  }
}

export async function listBranchUsers(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const result = await superAdminService.listBranchUsers(id)
    return res.status(200).json(result)
  } catch (error) {
    return sendError(res, error)
  }
}

export async function listBranchServices(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const result = await superAdminService.listBranchServices(id)
    return res.status(200).json(result)
  } catch (error) {
    return sendError(res, error)
  }
}

export async function listServiceBranches(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const result = await superAdminService.listServiceBranches(id)
    return res.status(200).json(result)
  } catch (error) {
    return sendError(res, error)
  }
}
