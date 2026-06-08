import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken'
import type { StringValue } from 'ms'

export type AppJwtRole = 'super_admin' | 'admin' | 'staff'

export type AccessTokenPayload = {
  sub: string
  role: AppJwtRole
  branchId?: string
  av: number
}

export type RefreshTokenPayload = {
  sub: string
}

function getEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

function sign<T extends object>(payload: T, secret: string, options: SignOptions): string {
  return jwt.sign(payload, secret, options)
}

function verifyToken<T>(token: string, secret: string): T {
  const decoded = jwt.verify(token, secret)
  return decoded as T
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const secret = getEnv('JWT_ACCESS_SECRET')
  const expiresIn: StringValue | number = (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as StringValue
  return sign(payload, secret, { expiresIn })
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  const secret = getEnv('JWT_REFRESH_SECRET')
  const expiresIn: StringValue | number = (process.env.JWT_REFRESH_EXPIRES_IN || '30d') as StringValue
  return sign(payload, secret, { expiresIn })
}

export function verifyAccessToken(token: string): AccessTokenPayload & JwtPayload {
  const secret = getEnv('JWT_ACCESS_SECRET')
  return verifyToken<AccessTokenPayload & JwtPayload>(token, secret)
}

export function verifyRefreshToken(token: string): RefreshTokenPayload & JwtPayload {
  const secret = getEnv('JWT_REFRESH_SECRET')
  return verifyToken<RefreshTokenPayload & JwtPayload>(token, secret)
}
