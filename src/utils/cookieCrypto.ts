import crypto from 'crypto'

function getKeyMaterial() {
  return process.env.COOKIE_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET || 'default-cookie-key'
}

function getKey() {
  return crypto.createHash('sha256').update(getKeyMaterial()).digest()
}

export function encryptCookieValue(value: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`
}

export function decryptCookieValue(value: string): string {
  const [ivB64, tagB64, encryptedB64] = value.split('.')
  if (!ivB64 || !tagB64 || !encryptedB64) throw new Error('Invalid encrypted cookie format')

  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const encrypted = Buffer.from(encryptedB64, 'base64')

  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}
