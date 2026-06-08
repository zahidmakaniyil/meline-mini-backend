import crypto from 'crypto'

function getRequestKeyMaterial() {
  return process.env.AUTH_REQUEST_ENCRYPTION_KEY || 'meline-mini-login-payload-key'
}

function getRequestKey() {
  return crypto.createHash('sha256').update(getRequestKeyMaterial()).digest()
}

export type EncryptedPayload = {
  payload: string
}

export function decryptRequestPayload(payload: string): unknown {
  const [ivB64, tagB64, encryptedB64] = payload.split('.')
  if (!ivB64 || !tagB64 || !encryptedB64) {
    throw new Error('Invalid encrypted payload format')
  }

  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const encrypted = Buffer.from(encryptedB64, 'base64')

  const decipher = crypto.createDecipheriv('aes-256-gcm', getRequestKey(), iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return JSON.parse(decrypted.toString('utf8')) as unknown
}
