export type FlowNodeType = 'start' | 'message' | 'question' | 'options' | 'input' | 'end'

export type FlowInputType = 'text' | 'email' | 'phone' | 'number' | 'cpf'

export type FlowOption = {
  id: string
  label: string
  value?: string
}

export type FlowNode = {
  id: string
  type: FlowNodeType | string
  data?: {
    label?: string
    text?: string
    /** Options for the "options" (multiple choice) node. */
    options?: FlowOption[]
    /** Variable name where the captured answer is stored. */
    variable?: string
    /** Expected input type for the "input" node. */
    inputType?: FlowInputType
    /** Max re-ask attempts before falling back. Defaults to engine value. */
    maxAttempts?: number
    /** Message sent when the answer is invalid / not understood. */
    invalidMessage?: string
    /** When false, options are not appended to the bot message text. */
    listOptions?: boolean
  }
}

export type FlowEdge = {
  id?: string
  source: string
  target: string
  sourceHandle?: string | null
}

export type FlowDefinition = {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export type FlowVariables = Record<string, string>

export type FlowEngineState = {
  flowId: string
  currentNodeId: string
  awaitingInput: boolean
  /** Re-ask attempts already spent on the current awaiting node. */
  attempts?: number
}

export type ConversationMetadata = {
  flowEngine?: FlowEngineState
  variables?: FlowVariables
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
