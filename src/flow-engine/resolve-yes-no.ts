const YES_REPLIES = new Set([
  'sim',
  's',
  'yes',
  'y',
  'claro',
  'ok',
  'confirmo',
  'verdadeiro',
  '1',
  'si',
])

const NO_REPLIES = new Set([
  'nao',
  'n',
  'no',
  'negativo',
  'false',
  '0',
])

export function resolveYesNoBranch(content: string): 'yes' | 'no' | null {
  const normalized = content
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')

  if (!normalized) {
    return null
  }

  const firstWord = normalized.split(/\s+/)[0] ?? normalized

  if (YES_REPLIES.has(firstWord) || YES_REPLIES.has(normalized)) {
    return 'yes'
  }

  if (NO_REPLIES.has(firstWord) || NO_REPLIES.has(normalized)) {
    return 'no'
  }

  return null
}
