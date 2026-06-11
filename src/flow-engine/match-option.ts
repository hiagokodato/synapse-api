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
