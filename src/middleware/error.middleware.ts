import type { NextFunction, Request, Response } from 'express'
import { sendError } from '../utils/http'

export function notFound(req: Request, res: Response) {
  return res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` })
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err)
  return sendError(res, err)
}
