import type {
  FlowDefinition,
  FlowInputType,
  FlowNode,
  FlowNodeType,
  FlowOption,
} from './flow-engine.types'

const VALID_NODE_TYPES: FlowNodeType[] = [
  'start',
  'message',
  'question',
  'options',
  'input',
  'end',
]

const VALID_INPUT_TYPES: FlowInputType[] = ['text', 'email', 'phone', 'number', 'cpf']

function parseOptions(raw: unknown): FlowOption[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined
  }

  const options: FlowOption[] = []

  raw.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      return
    }

    const item = entry as Record<string, unknown>
    const label = typeof item.label === 'string' ? item.label : undefined
    if (!label || !label.trim()) {
      return
    }

    const id = typeof item.id === 'string' && item.id.trim() ? item.id : `opt-${index}`
    const value = typeof item.value === 'string' ? item.value : undefined

    options.push({ id, label, ...(value !== undefined ? { value } : {}) })
  })

  return options.length > 0 ? options : undefined
}

export function parseFlowDefinition(raw: unknown): FlowDefinition | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const candidate = raw as Partial<FlowDefinition>

  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
    return null
  }

  const nodes: FlowNode[] = []

  for (const node of candidate.nodes) {
    if (!node || typeof node !== 'object') {
      return null
    }

    const item = node as Record<string, unknown>
    const id = item.id
    const type = item.type
    const data = item.data as Record<string, unknown> | undefined

    if (typeof id !== 'string' || !id.trim()) {
      return null
    }

    if (typeof type !== 'string' || !VALID_NODE_TYPES.includes(type as FlowNodeType)) {
      return null
    }

    const inputType =
      typeof data?.inputType === 'string' &&
      VALID_INPUT_TYPES.includes(data.inputType as FlowInputType)
        ? (data.inputType as FlowInputType)
        : undefined

    nodes.push({
      id,
      type: type as FlowNodeType,
      data: {
        label: typeof data?.label === 'string' ? data.label : undefined,
        text: typeof data?.text === 'string' ? data.text : undefined,
        options: parseOptions(data?.options),
        variable:
          typeof data?.variable === 'string' && data.variable.trim()
            ? data.variable.trim()
            : undefined,
        inputType,
        maxAttempts:
          typeof data?.maxAttempts === 'number' && Number.isFinite(data.maxAttempts)
            ? Math.max(0, Math.floor(data.maxAttempts))
            : undefined,
        invalidMessage:
          typeof data?.invalidMessage === 'string' ? data.invalidMessage : undefined,
        listOptions: typeof data?.listOptions === 'boolean' ? data.listOptions : undefined,
      },
    })
  }

  const edges = candidate.edges
    .map((edge, index) => {
      if (!edge || typeof edge !== 'object') {
        return null
      }

      const item = edge as Record<string, unknown>
      const source = item.source
      const target = item.target

      if (typeof source !== 'string' || typeof target !== 'string') {
        return null
      }

      return {
        id: typeof item.id === 'string' ? item.id : `edge-${index}`,
        source,
        target,
        ...(typeof item.sourceHandle === 'string' ? { sourceHandle: item.sourceHandle } : {}),
      }
    })
    .filter((edge): edge is NonNullable<typeof edge> => edge !== null)

  return { nodes, edges }
}
