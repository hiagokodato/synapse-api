const TELEGRAM_API = 'https://api.telegram.org'

export type TelegramInbound = {
  chatId: string
  text: string
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<void> {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Telegram sendMessage failed (${res.status}): ${body}`)
  }
}

export async function setTelegramWebhook(
  botToken: string,
  url: string,
  secretToken: string,
): Promise<void> {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      secret_token: secretToken,
      allowed_updates: ['message'],
    }),
  })

  const data = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null
  if (!res.ok || !data?.ok) {
    throw new Error(`Telegram setWebhook failed: ${data?.description ?? res.status}`)
  }
}

export async function getTelegramBotId(botToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/getMe`)
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; result?: { id?: number } }
      | null
    if (!res.ok || !data?.ok || data.result?.id === undefined) {
      return null
    }
    return String(data.result.id)
  } catch {
    return null
  }
}

export function parseTelegramUpdate(body: unknown): TelegramInbound | null {
  const update = (body ?? {}) as Record<string, unknown>
  const message = (update.message ?? update.edited_message) as Record<string, unknown> | undefined
  if (!message) {
    return null
  }

  const chat = message.chat as { id?: unknown } | undefined
  const text = message.text

  if (chat?.id === undefined || typeof text !== 'string') {
    return null
  }

  return { chatId: String(chat.id), text }
}
