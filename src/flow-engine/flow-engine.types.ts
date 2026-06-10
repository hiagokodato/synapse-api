export type FlowNodeType = 'start' | 'message' | 'question' | 'end'

export type FlowNode = {
  id: string
  type: FlowNodeType | string
  data?: {
    label?: string
    text?: string
  }
}

export type FlowEdge = {
  id?: string
  source: string
  target: string
}

export type FlowDefinition = {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export type FlowEngineState = {
  flowId: string
  currentNodeId: string
  awaitingInput: boolean
}

export type ConversationMetadata = {
  flowEngine?: FlowEngineState
  [key: string]: unknown
}

export type BotMessageRecord = {
  id: string
  conversationId: string
  role: 'BOT'
  content: string
  metadata: Record<string, unknown>
  createdAt: Date
}
