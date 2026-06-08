import type { Request, Response } from 'express'
import { createBranchSchema, updateBranchSchema } from '../validators/branch.validator'
import * as branchService from '../services/branch.service'
import { sendError } from '../utils/http'

export async function create(req: Request, res: Response) {
  try {
    const body = createBranchSchema.parse(req.body)
    const branch = await branchService.createBranch(body, req.user?.userId)
    return res.status(201).json(branch)
  } catch (error) {
    return sendError(res, error)
  }
}

export async function list(req: Request, res: Response) {
  try {
    const page = typeof req.query.page === 'string' ? Number(req.query.page) : undefined
    const pageSize = typeof req.query.pageSize === 'string' ? Number(req.query.pageSize) : undefined
    const search = typeof req.query.search === 'string' ? req.query.search : undefined
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : undefined
    const sortOrder = req.query.sortOrder === 'asc' || req.query.sortOrder === 'desc' ? req.query.sortOrder : undefined
    const isActive =
      typeof req.query.isActive === 'string' ? (req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined) : undefined

    const branches = await branchService.listBranches({
      page,
      pageSize,
      search,
      sortBy,
      sortOrder,
      isActive,
    })
    return res.status(200).json(branches)
  } catch (error) {
    return sendError(res, error)
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const branch = await branchService.getBranchById(id)
    return res.status(200).json(branch)
  } catch (error) {
    return sendError(res, error)
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const body = updateBranchSchema.parse(req.body)
    const branch = await branchService.updateBranch(id, body, req.user?.userId)
    return res.status(200).json(branch)
  } catch (error) {
    return sendError(res, error)
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const branch = await branchService.softDeleteBranch(id, req.user?.userId)
    return res.status(200).json(branch)
  } catch (error) {
    return sendError(res, error)
  }
}
