import type { WhatsappCredentials } from '../integration.types'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

export type WhatsappInbound = {
  from: string
  text: string
  phoneNumberId?: string
}

export async function sendWhatsappMessage(
  credentials: Pick<WhatsappCredentials, 'accessToken' | 'phoneNumberId'>,
  to: string,
  text: string,
): Promise<void> {
  const res = await fetch(`${GRAPH_API}/${credentials.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: text },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`WhatsApp sendMessage failed (${res.status}): ${body}`)
  }
}

export function parseWhatsappMessages(body: unknown): WhatsappInbound[] {
  const payload = (body ?? {}) as Record<string, unknown>
  const entries = Array.isArray(payload.entry) ? payload.entry : []
  const result: WhatsappInbound[] = []

  for (const entry of entries) {
    const changes = Array.isArray((entry as Record<string, unknown>)?.changes)
      ? ((entry as Record<string, unknown>).changes as Array<Record<string, unknown>>)
      : []

    for (const change of changes) {
      const value = (change?.value ?? {}) as Record<string, unknown>
      const metadata = (value.metadata ?? {}) as { phone_number_id?: string }
      const messages = Array.isArray(value.messages)
        ? (value.messages as Array<Record<string, unknown>>)
        : []

      for (const message of messages) {
        const from = message?.from
        const textObj = message?.text as { body?: unknown } | undefined
        const text = textObj?.body

        if (typeof from === 'string' && typeof text === 'string') {
          result.push({ from, text, phoneNumberId: metadata.phone_number_id })
        }
      }
    }
  }

  return result
}
