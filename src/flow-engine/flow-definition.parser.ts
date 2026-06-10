import type { FlowDefinition, FlowNode, FlowNodeType } from './flow-engine.types'

const VALID_NODE_TYPES: FlowNodeType[] = ['start', 'message', 'question', 'end']

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
    const data = item.data as { label?: unknown; text?: unknown } | undefined

    if (typeof id !== 'string' || !id.trim()) {
      return null
    }

    if (typeof type !== 'string' || !VALID_NODE_TYPES.includes(type as FlowNodeType)) {
      return null
    }

    nodes.push({
      id,
      type: type as FlowNodeType,
      data: {
        label: typeof data?.label === 'string' ? data.label : undefined,
        text: typeof data?.text === 'string' ? data.text : undefined,
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
      }
    })
    .filter((edge): edge is NonNullable<typeof edge> => edge !== null)

  return { nodes, edges }
}
