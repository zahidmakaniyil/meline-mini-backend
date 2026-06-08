import type { Request, Response } from 'express'
import { createAppModuleSchema, updateAppModuleSchema } from '../validators/appModule.validator'
import * as moduleCatalog from '../services/moduleCatalog.service'
import { sendError } from '../utils/http'

export async function listModules(req: Request, res: Response) {
  try {
    const page = typeof req.query.page === 'string' ? Number(req.query.page) : undefined
    const pageSize = typeof req.query.pageSize === 'string' ? Number(req.query.pageSize) : undefined
    const search = typeof req.query.search === 'string' ? req.query.search : undefined
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : undefined
    const sortOrder = req.query.sortOrder === 'asc' || req.query.sortOrder === 'desc' ? req.query.sortOrder : undefined
    const includeInactive = req.query.includeInactive === 'true'

    const result = await moduleCatalog.listAppModules({
      page,
      pageSize,
      search,
      sortBy,
      sortOrder,
      includeInactive,
    })
    return res.status(200).json(result)
  } catch (error) {
    return sendError(res, error)
  }
}

export async function getModule(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const row = await moduleCatalog.getAppModuleById(id)
    return res.status(200).json(row)
  } catch (error) {
    return sendError(res, error)
  }
}

export async function createModule(req: Request, res: Response) {
  try {
    const body = createAppModuleSchema.parse(req.body)
    const row = await moduleCatalog.createAppModule(body, req.user?.userId)
    return res.status(201).json(row)
  } catch (error) {
    return sendError(res, error)
  }
}

export async function updateModule(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const body = updateAppModuleSchema.parse(req.body)
    const row = await moduleCatalog.updateAppModule(id, body, req.user?.userId)
    return res.status(200).json(row)
  } catch (error) {
    return sendError(res, error)
  }
}

export async function removeModule(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const row = await moduleCatalog.softDeleteAppModule(id, req.user?.userId)
    return res.status(200).json(row)
  } catch (error) {
    return sendError(res, error)
  }
}
