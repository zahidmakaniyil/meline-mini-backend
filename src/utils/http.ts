import type { Response } from 'express'
import type { ZodError } from 'zod'

export class HttpError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

export function sendError(res: Response, error: unknown) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message, details: error.details })
  }

  const maybeMongo = error as {
    name?: string
    code?: number
    keyPattern?: Record<string, unknown>
    keyValue?: Record<string, unknown>
  } | null
  if (maybeMongo?.name === 'MongoServerError' && maybeMongo.code === 11000) {
    const key = Object.keys(maybeMongo.keyPattern ?? maybeMongo.keyValue ?? {})[0]
    if (key === 'email') return res.status(409).json({ message: 'Email already in use' })
    if (key) return res.status(409).json({ message: `${key} already exists` })
    return res.status(409).json({ message: 'Duplicate value already exists' })
  }

  const maybeZod = error as { name?: string } | null
  if (maybeZod?.name === 'ZodError') {
    const zod = error as ZodError
    return res.status(400).json({ message: 'Validation error', details: zod.flatten() })
  }

  const message = error instanceof Error ? error.message : 'Internal server error'
  return res.status(500).json({ message })
}
