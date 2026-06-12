import { interpolate } from './interpolate'
import { matchOption, matchOptions } from './match-option'
import { resolveYesNoBranch } from './resolve-yes-no'
import { validateInput } from './validate-input'
import type { FlowDefinition, FlowNode, FlowVariables } from './flow-engine.types'

/**
 * Pure, in-memory flow runner used by the builder simulator. It mirrors the
 * traversal/decision logic of `FlowEngineService` but without any persistence,
 * so the same definition behaves identically to a live conversation.
 *
 * IMPORTANT: keep this in sync with `flow-engine.service.ts`. Any change to how
 * nodes are traversed/answered in the engine must be reflected here.
 */

const FALLBACK_HANDLE = 'fallback'
const MAX_STEPS = 32
const EMPTY_MESSAGE = '...'
const CLOSING_MESSAGE = 'Conversa encerrada.'

export type SimulationStatus = 'awaiting' | 'ended' | 'idle'

export type SimulationMessage = {
  nodeId: string
  nodeType: string
  content: string
}

export type SimulationState = {
  currentNodeId: string
  awaitingInput: boolean
  attempts: number
}

export type SimulationResult = {
  messages: SimulationMessage[]
  state: SimulationState | null
  variables: FlowVariables
  status: SimulationStatus
}

function getTargetByHandle(
  definition: FlowDefinition,
  nodeId: string,
  sourceHandle: string,
): string | null {
  const matched = definition.edges.find(
    (edge) => edge.source === nodeId && edge.sourceHandle === sourceHandle,
  )
  return matched?.target ?? null
}

function getDefaultTarget(definition: FlowDefinition, nodeId: string): string | null {
  const outgoing = definition.edges.filter((edge) => edge.source === nodeId)
  const legacy = outgoing.find((edge) => !edge.sourceHandle)
  if (legacy) {
    return legacy.target
  }
  return outgoing[0]?.target ?? null
}

function getNextNodeId(
  definition: FlowDefinition,
  nodeId: string,
  sourceHandle?: string | null,
): string | null {
  if (sourceHandle) {
    const matched = getTargetByHandle(definition, nodeId, sourceHandle)
    if (matched) {
      return matched
    }
  }
  return getDefaultTarget(definition, nodeId)
}

function composeNodeMessage(node: FlowNode, variables: FlowVariables, fallback?: string): string {
  const base = (node.data?.text?.trim() || node.data?.label?.trim() || fallback || '').trim()
  let content = interpolate(base, variables)

  if (
    (node.type === 'options' || node.type === 'list') &&
    node.data?.options?.length &&
    node.data.listOptions !== false
  ) {
    const list = node.data.options
      .map((option, index) => `${index + 1}. ${option.label}`)
      .join('\n')
    content = content ? `${content}\n${list}` : list
  }

  return content
}

function defaultInvalidMessage(node: FlowNode): string {
  const custom = node.data?.invalidMessage?.trim()
  if (custom) {
    return custom
  }

  if (node.type === 'input') {
    switch (node.data?.inputType) {
      case 'email':
        return 'Por favor, informe um e-mail válido.'
      case 'phone':
        return 'Por favor, informe um telefone válido.'
      case 'number':
        return 'Por favor, informe um número válido.'
      case 'cpf':
        return 'Por favor, informe um CPF válido.'
      default:
        return 'Por favor, tente novamente.'
    }
  }

  return 'Desculpe, não entendi. Pode tentar novamente?'
}

function pushMessage(messages: SimulationMessage[], node: FlowNode, content: string) {
  messages.push({ nodeId: node.id, nodeType: String(node.type), content: content || EMPTY_MESSAGE })
}

type Traversal = {
  messages: SimulationMessage[]
  state: SimulationState | null
  status: SimulationStatus
}

function runFromNode(
  definition: FlowDefinition,
  startNodeId: string,
  variables: FlowVariables,
): Traversal {
  const messages: SimulationMessage[] = []
  let currentNodeId: string | null = startNodeId
  let steps = 0

  while (currentNodeId && steps < MAX_STEPS) {
    steps += 1

    const node = definition.nodes.find((item) => item.id === currentNodeId)
    if (!node) {
      break
    }

    switch (node.type) {
      case 'start': {
        const next = getNextNodeId(definition, node.id)
        if (!next) {
          return { messages, state: null, status: 'idle' }
        }
        currentNodeId = next
        continue
      }

      case 'message': {
        pushMessage(messages, node, composeNodeMessage(node, variables))
        const next = getNextNodeId(definition, node.id)
        if (!next) {
          return {
            messages,
            state: { currentNodeId: node.id, awaitingInput: false, attempts: 0 },
            status: 'idle',
          }
        }
        currentNodeId = next
        continue
      }

      case 'question':
      case 'options':
      case 'list':
      case 'input': {
        pushMessage(messages, node, composeNodeMessage(node, variables))
        return {
          messages,
          state: { currentNodeId: node.id, awaitingInput: true, attempts: 0 },
          status: 'awaiting',
        }
      }

      case 'end': {
        pushMessage(messages, node, composeNodeMessage(node, variables, CLOSING_MESSAGE))
        return {
          messages,
          state: { currentNodeId: node.id, awaitingInput: false, attempts: 0 },
          status: 'ended',
        }
      }

      default:
        return { messages, state: null, status: 'idle' }
    }
  }

  return { messages, state: null, status: 'idle' }
}

export function simulateStart(definition: FlowDefinition): SimulationResult {
  const variables: FlowVariables = {}
  const startNode = definition.nodes.find((node) => node.type === 'start')
  if (!startNode) {
    return { messages: [], state: null, variables, status: 'idle' }
  }

  const firstTarget = getNextNodeId(definition, startNode.id)
  if (!firstTarget) {
    return { messages: [], state: null, variables, status: 'idle' }
  }

  const traversal = runFromNode(definition, firstTarget, variables)
  return { ...traversal, variables }
}

function handleUnresolved(
  definition: FlowDefinition,
  node: FlowNode,
  state: SimulationState,
  variables: FlowVariables,
): SimulationResult {
  const maxAttempts = node.data?.maxAttempts ?? 0
  const attempts = state.attempts ?? 0

  if (attempts < maxAttempts) {
    const content = composeNodeMessage(node, variables, defaultInvalidMessage(node))
    const messages: SimulationMessage[] = []
    pushMessage(messages, node, content)
    return {
      messages,
      state: { currentNodeId: node.id, awaitingInput: true, attempts: attempts + 1 },
      variables,
      status: 'awaiting',
    }
  }

  const fallbackTarget = getTargetByHandle(definition, node.id, FALLBACK_HANDLE)
  if (fallbackTarget) {
    return { ...runFromNode(definition, fallbackTarget, variables), variables }
  }

  const defaultTarget = getDefaultTarget(definition, node.id)
  if (defaultTarget) {
    return { ...runFromNode(definition, defaultTarget, variables), variables }
  }

  return {
    messages: [],
    state: { currentNodeId: node.id, awaitingInput: false, attempts: 0 },
    variables,
    status: 'idle',
  }
}

export function simulateReply(
  definition: FlowDefinition,
  state: SimulationState,
  variables: FlowVariables,
  message: string,
): SimulationResult {
  const vars: FlowVariables = { ...variables }
  const node = definition.nodes.find((item) => item.id === state.currentNodeId)

  if (!node) {
    return {
      messages: [],
      state: { ...state, awaitingInput: false },
      variables: vars,
      status: 'idle',
    }
  }

  const advance = (sourceHandle: string | null): SimulationResult => {
    const next = getNextNodeId(definition, node.id, sourceHandle)
    if (!next) {
      return {
        messages: [],
        state: { currentNodeId: node.id, awaitingInput: false, attempts: 0 },
        variables: vars,
        status: 'idle',
      }
    }
    return { ...runFromNode(definition, next, vars), variables: vars }
  }

  switch (node.type) {
    case 'question': {
      const branch = resolveYesNoBranch(message)
      if (branch) {
        return advance(branch)
      }
      return handleUnresolved(definition, node, state, vars)
    }

    case 'options': {
      const option = matchOption(message, node.data?.options ?? [])
      if (option) {
        if (node.data?.variable) {
          vars[node.data.variable] = option.value ?? option.label
        }
        return advance(option.id)
      }
      return handleUnresolved(definition, node, state, vars)
    }

    case 'list': {
      const matched = matchOptions(message, node.data?.options ?? [])
      if (matched.length > 0) {
        const allowMultiple = node.data?.multiple !== false
        const chosen = allowMultiple ? matched : [matched[0]]
        if (node.data?.variable) {
          vars[node.data.variable] = chosen.map((option) => option.value ?? option.label).join(', ')
        }
        return advance(null)
      }
      return handleUnresolved(definition, node, state, vars)
    }

    case 'input': {
      const result = validateInput(message, node.data?.inputType)
      if (result.valid) {
        if (node.data?.variable) {
          vars[node.data.variable] = result.value
        }
        return advance(null)
      }
      return handleUnresolved(definition, node, state, vars)
    }

    default:
      return advance(null)
  }
}
