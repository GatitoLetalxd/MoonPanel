const crypto = require('crypto')

const ALGORITHM = 'aes-256-cbc'
const SECRET = process.env.JWT_SECRET || 'fallback_secret_for_development_purposes_only'

// Derivar clave de 32 bytes a partir del JWT_SECRET usando SHA-256
const KEY = crypto.createHash('sha256').update(SECRET).digest()

function encrypt(text) {
  if (!text) return ''
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return `${iv.toString('hex')}:${encrypted}`
}

function decrypt(encryptedText) {
  if (!encryptedText) return ''
  try {
    const parts = encryptedText.split(':')
    if (parts.length !== 2) return ''
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (err) {
    console.error('[CRYPTO] Fallo al desencriptar texto:', err.message)
    return ''
  }
}

module.exports = { encrypt, decrypt }
