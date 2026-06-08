import type { Request, Response } from 'express'
import { createStaffTypeSchema, updateStaffTypeSchema } from '../validators/staffType.validator'
import * as staffTypeService from '../services/staffType.service'
import { sendError } from '../utils/http'

export async function list(req: Request, res: Response) {
  try {
    const page = typeof req.query.page === 'string' ? Number(req.query.page) : undefined
    const pageSize = typeof req.query.pageSize === 'string' ? Number(req.query.pageSize) : undefined
    const search = typeof req.query.search === 'string' ? req.query.search : undefined
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : undefined
    const sortOrder = req.query.sortOrder === 'asc' || req.query.sortOrder === 'desc' ? req.query.sortOrder : undefined
    const includeInactive = req.query.includeInactive === 'true' ? true : req.query.includeInactive === 'false' ? false : undefined

    const result = await staffTypeService.listStaffTypes({ page, pageSize, search, sortBy, sortOrder, includeInactive })
    return res.status(200).json(result)
  } catch (error) {
    return sendError(res, error)
  }
}

export async function create(req: Request, res: Response) {
  try {
    const body = createStaffTypeSchema.parse(req.body)
    const doc = await staffTypeService.createStaffType(body, req.user?.userId)
    return res.status(201).json(doc)
  } catch (error) {
    return sendError(res, error)
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const body = updateStaffTypeSchema.parse(req.body)
    const doc = await staffTypeService.updateStaffType(id, body, req.user?.userId)
    return res.status(200).json(doc)
  } catch (error) {
    return sendError(res, error)
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const doc = await staffTypeService.softDeleteStaffType(id, req.user?.userId)
    return res.status(200).json(doc)
  } catch (error) {
    return sendError(res, error)
  }
}
