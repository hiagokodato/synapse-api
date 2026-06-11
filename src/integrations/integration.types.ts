export type TelegramCredentials = {
  botToken: string
}

export type WhatsappCredentials = {
  accessToken: string
  phoneNumberId: string
  verifyToken: string
}

export type IntegrationCredentials = TelegramCredentials | WhatsappCredentials

export function asTelegramCredentials(raw: unknown): TelegramCredentials {
  const value = (raw ?? {}) as Record<string, unknown>
  return { botToken: typeof value.botToken === 'string' ? value.botToken : '' }
}

export function asWhatsappCredentials(raw: unknown): WhatsappCredentials {
  const value = (raw ?? {}) as Record<string, unknown>
  return {
    accessToken: typeof value.accessToken === 'string' ? value.accessToken : '',
    phoneNumberId: typeof value.phoneNumberId === 'string' ? value.phoneNumberId : '',
    verifyToken: typeof value.verifyToken === 'string' ? value.verifyToken : '',
  }
}
