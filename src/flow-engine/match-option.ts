import type { FlowOption } from './flow-engine.types'

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/**
 * Matches a free-text user reply against a list of options.
 * Resolution order: numeric index (1-based) -> value -> id -> exact label ->
 * unique partial label match.
 */
export function matchOption(content: string, options: FlowOption[]): FlowOption | null {
  if (!content || options.length === 0) {
    return null
  }

  const normalized = normalize(content)
  if (!normalized) {
    return null
  }

  const asIndex = Number.parseInt(normalized, 10)
  if (
    String(asIndex) === normalized &&
    asIndex >= 1 &&
    asIndex <= options.length
  ) {
    return options[asIndex - 1]
  }

  for (const option of options) {
    if (option.value && normalize(option.value) === normalized) {
      return option
    }
    if (normalize(option.id) === normalized) {
      return option
    }
    if (normalize(option.label) === normalized) {
      return option
    }
  }

  const partial = options.filter((option) => normalize(option.label).includes(normalized))
  if (partial.length === 1) {
    return partial[0]
  }

  return null
}

/**
 * Matches a free-text reply that may contain several selections at once
 * (e.g. "1, 3", "azul e verde", "a; b"). Returns the matched options in the
 * order they were selected, without duplicates.
 */
export function matchOptions(content: string, options: FlowOption[]): FlowOption[] {
  if (!content || options.length === 0) {
    return []
  }

  const tokens = content
    .split(/[,;/\n]+|\s+e\s+|\s+and\s+/i)
    .map((token) => token.trim())
    .filter(Boolean)

  const candidates = tokens.length > 0 ? tokens : [content]

  const selected: FlowOption[] = []
  const seen = new Set<string>()

  for (const token of candidates) {
    const option = matchOption(token, options)
    if (option && !seen.has(option.id)) {
      seen.add(option.id)
      selected.push(option)
    }
  }

  return selected
}
