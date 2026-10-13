import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/** Formato gravado na coluna `credentials` (JSON) quando criptografado. */
type EncryptedPayload = { v: 1; iv: string; tag: string; data: string }

function isEncrypted(value: unknown): value is EncryptedPayload {
  const candidate = value as Partial<EncryptedPayload> | null
  return (
    !!candidate &&
    candidate.v === 1 &&
    typeof candidate.iv === 'string' &&
    typeof candidate.tag === 'string' &&
    typeof candidate.data === 'string'
  )
}

/**
 * Criptografa as credenciais das integrações (tokens do Telegram/WhatsApp) com AES-256-GCM,
 * para que um vazamento do banco não exponha os bots dos usuários.
 * A chave vem de CREDENTIALS_ENCRYPTION_KEY (qualquer texto longo; é derivada com SHA-256).
 */
export class CredentialsCipher {
  private readonly key: Buffer

  constructor(secret: string) {
    if (!secret || secret.length < 32) {
      throw new Error('CREDENTIALS_ENCRYPTION_KEY must be set (min. 32 characters).')
    }
    this.key = createHash('sha256').update(secret).digest()
  }

  encrypt(credentials: Record<string, string>): EncryptedPayload {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const data = Buffer.concat([cipher.update(JSON.stringify(credentials), 'utf8'), cipher.final()])
    return {
      v: 1,
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      data: data.toString('base64'),
    }
  }

  /** Aceita também o formato antigo (texto puro), para integrações criadas antes da criptografia. */
  decrypt(stored: unknown): Record<string, unknown> {
    if (!isEncrypted(stored)) {
      return (stored ?? {}) as Record<string, unknown>
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(stored.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(stored.tag, 'base64'))
    const plain = Buffer.concat([
      decipher.update(Buffer.from(stored.data, 'base64')),
      decipher.final(),
    ])
    return JSON.parse(plain.toString('utf8')) as Record<string, unknown>
  }

  isEncrypted(stored: unknown): boolean {
    return isEncrypted(stored)
  }
}
