import type { FlowNodeType } from './flow-engine.types'

export type FlowValidationLevel = 'error' | 'warning'

export type FlowValidationIssue = {
  level: FlowValidationLevel
  code: string
  message: string
  nodeId?: string
  edgeId?: string
}

export type FlowValidationResult = {
  valid: boolean
  issues: FlowValidationIssue[]
}

const VALID_NODE_TYPES: FlowNodeType[] = [
  'start',
  'message',
  'question',
  'options',
  'input',
  'end',
]

const AWAITING_TYPES = new Set<FlowNodeType>(['question', 'options', 'input'])

export function validateFlowDefinition(raw: unknown): FlowValidationResult {
  const issues: FlowValidationIssue[] = []
  const add = (issue: FlowValidationIssue) => issues.push(issue)
  const result = (): FlowValidationResult => ({
    valid: !issues.some((issue) => issue.level === 'error'),
    issues,
  })

  if (!raw || typeof raw !== 'object') {
    add({
      level: 'error',
      code: 'invalid_definition',
      message: 'A definição do fluxo está vazia ou inválida.',
    })
    return result()
  }

  const candidate = raw as { nodes?: unknown; edges?: unknown }

  if (!Array.isArray(candidate.nodes)) {
    add({ level: 'error', code: 'missing_nodes', message: 'A lista de nós (nodes) é obrigatória.' })
  }
  if (!Array.isArray(candidate.edges)) {
    add({
      level: 'error',
      code: 'missing_edges',
      message: 'A lista de conexões (edges) é obrigatória.',
    })
  }

  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
    return result()
  }

  const rawNodes = candidate.nodes as Array<Record<string, unknown>>
  const rawEdges = candidate.edges as Array<Record<string, unknown>>

  const nodeIds = new Set<string>()
  const nodeTypeById = new Map<string, string>()

  rawNodes.forEach((node, index) => {
    if (!node || typeof node !== 'object') {
      add({ level: 'error', code: 'invalid_node', message: `O nó #${index + 1} é inválido.` })
      return
    }

    const id = typeof node.id === 'string' ? node.id.trim() : ''
    const type = typeof node.type === 'string' ? node.type : ''

    if (!id) {
      add({ level: 'error', code: 'node_missing_id', message: `O nó #${index + 1} está sem id.` })
      return
    }

    if (nodeIds.has(id)) {
      add({ level: 'error', code: 'duplicate_node_id', message: `Id de nó duplicado: "${id}".`, nodeId: id })
    }
    nodeIds.add(id)
    nodeTypeById.set(id, type)

    if (!VALID_NODE_TYPES.includes(type as FlowNodeType)) {
      add({
        level: 'error',
        code: 'invalid_node_type',
        message: `Tipo de nó inválido: "${type}".`,
        nodeId: id,
      })
    }

    const data = (node.data ?? {}) as Record<string, unknown>

    if (type === 'options') {
      const options = Array.isArray(data.options) ? data.options : []
      if (options.length === 0) {
        add({
          level: 'error',
          code: 'options_empty',
          message: 'O bloco de opções precisa de pelo menos uma opção.',
          nodeId: id,
        })
      }
    }

    if (type === 'input' && (typeof data.variable !== 'string' || !data.variable.trim())) {
      add({
        level: 'warning',
        code: 'input_without_variable',
        message: 'O bloco de captura não tem uma variável definida; a resposta não será salva.',
        nodeId: id,
      })
    }
  })

  const startNodes = [...nodeTypeById.entries()].filter(([, type]) => type === 'start')
  if (startNodes.length === 0) {
    add({ level: 'error', code: 'no_start', message: 'O fluxo precisa de um nó inicial (start).' })
  } else if (startNodes.length > 1) {
    add({
      level: 'error',
      code: 'multiple_start',
      message: `O fluxo tem ${startNodes.length} nós iniciais; deve haver apenas um.`,
    })
  }

  if (![...nodeTypeById.values()].includes('end')) {
    add({ level: 'warning', code: 'no_end', message: 'O fluxo não tem um nó de encerramento (end).' })
  }

  const adjacency = new Map<string, string[]>()
  const hasOutgoing = new Set<string>()

  rawEdges.forEach((edge, index) => {
    const edgeId = typeof edge?.id === 'string' ? edge.id : `edge-${index}`
    const source = typeof edge?.source === 'string' ? edge.source : ''
    const target = typeof edge?.target === 'string' ? edge.target : ''

    if (!source || !target) {
      add({
        level: 'error',
        code: 'invalid_edge',
        message: `A conexão #${index + 1} está sem origem ou destino.`,
        edgeId,
      })
      return
    }

    if (!nodeIds.has(source)) {
      add({
        level: 'error',
        code: 'edge_unknown_source',
        message: `A conexão "${edgeId}" aponta de um nó inexistente ("${source}").`,
        edgeId,
      })
    }
    if (!nodeIds.has(target)) {
      add({
        level: 'error',
        code: 'edge_unknown_target',
        message: `A conexão "${edgeId}" aponta para um nó inexistente ("${target}").`,
        edgeId,
      })
    }

    if (nodeIds.has(source) && nodeIds.has(target)) {
      hasOutgoing.add(source)
      const list = adjacency.get(source) ?? []
      list.push(target)
      adjacency.set(source, list)
    }
  })

  nodeTypeById.forEach((type, id) => {
    if (type === 'end') {
      return
    }
    if (!hasOutgoing.has(id)) {
      add({
        level: type === 'start' || AWAITING_TYPES.has(type as FlowNodeType) ? 'error' : 'warning',
        code: 'dead_end',
        message: `O nó "${id}" não tem nenhuma conexão de saída.`,
        nodeId: id,
      })
    }
  })

  if (startNodes.length === 1) {
    const reachable = new Set<string>()
    const queue = [startNodes[0][0]]
    while (queue.length > 0) {
      const current = queue.shift() as string
      if (reachable.has(current)) {
        continue
      }
      reachable.add(current)
      for (const next of adjacency.get(current) ?? []) {
        if (!reachable.has(next)) {
          queue.push(next)
        }
      }
    }

    nodeTypeById.forEach((_type, id) => {
      if (!reachable.has(id)) {
        add({
          level: 'warning',
          code: 'unreachable_node',
          message: `O nó "${id}" não é alcançável a partir do início.`,
          nodeId: id,
        })
      }
    })
  }

  return result()
}
