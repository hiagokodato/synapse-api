import { Injectable, Logger } from '@nestjs/common'
import { ConversationStatus, MessageRole, type Prisma } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { parseFlowDefinition } from './flow-definition.parser'
import { interpolate } from './interpolate'
import { matchOption, matchOptions } from './match-option'
import { resolveYesNoBranch } from './resolve-yes-no'
import { validateInput } from './validate-input'
import type {
  BotMessageRecord,
  ConversationMetadata,
  FlowDefinition,
  FlowEngineState,
  FlowNode,
  FlowVariables,
} from './flow-engine.types'

const messageSelect = {
  id: true,
  conversationId: true,
  role: true,
  content: true,
  metadata: true,
  createdAt: true,
} satisfies Prisma.MessageSelect

const FALLBACK_HANDLE = 'fallback'

@Injectable()
export class FlowEngineService {
  private readonly logger = new Logger(FlowEngineService.name)
  private readonly maxSteps = 32

  constructor(private readonly prisma: PrismaService) {}

  async startConversation(chatbotId: string, conversationId: string): Promise<BotMessageRecord[]> {
    const flow = await this.getPublishedFlow(chatbotId)
    if (!flow) {
      return []
    }

    const definition = parseFlowDefinition(flow.definition)
    if (!definition) {
      this.logger.warn(`Flow ${flow.id} has an invalid definition.`)
      return []
    }

    const startNode = definition.nodes.find((node) => node.type === 'start')
    if (!startNode) {
      this.logger.warn(`Flow ${flow.id} has no start node.`)
      return []
    }

    const firstTarget = this.getNextNodeId(definition, startNode.id)
    if (!firstTarget) {
      this.logger.warn(`Flow ${flow.id} start node has no outgoing edge.`)
      return []
    }

    const variables = await this.loadVariables(conversationId)

    await this.updateFlowState(conversationId, {
      flowId: flow.id,
      currentNodeId: startNode.id,
      awaitingInput: false,
    })

    return this.runFromNode(conversationId, definition, flow.id, firstTarget, variables)
  }

  async handleUserMessage(chatbotId: string, conversationId: string): Promise<BotMessageRecord[]> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, chatbotId },
      select: { metadata: true, status: true },
    })

    if (!conversation || conversation.status === ConversationStatus.CLOSED) {
      return []
    }

    const metadata = conversation.metadata as ConversationMetadata
    const state = metadata.flowEngine

    if (!state?.awaitingInput) {
      return []
    }

    const flow = await this.prisma.flow.findFirst({
      where: { id: state.flowId, chatbotId },
      select: { id: true, definition: true },
    })

    if (!flow) {
      return []
    }

    const definition = parseFlowDefinition(flow.definition)
    if (!definition) {
      return []
    }

    const currentNode = definition.nodes.find((node) => node.id === state.currentNodeId)
    if (!currentNode) {
      await this.updateFlowState(conversationId, { ...state, awaitingInput: false })
      return []
    }

    const variables: FlowVariables = { ...(metadata.variables ?? {}) }
    const lastUserMessage = await this.getLastUserMessage(conversationId)

    switch (currentNode.type) {
      case 'question': {
        const branch = lastUserMessage ? resolveYesNoBranch(lastUserMessage) : null
        if (branch) {
          return this.advance(conversationId, definition, flow.id, currentNode.id, branch, variables)
        }
        return this.handleUnresolved(conversationId, definition, flow.id, currentNode, state, variables)
      }

      case 'options': {
        const option = lastUserMessage
          ? matchOption(lastUserMessage, currentNode.data?.options ?? [])
          : null

        if (option) {
          if (currentNode.data?.variable) {
            variables[currentNode.data.variable] = option.value ?? option.label
            await this.saveVariables(conversationId, variables)
          }
          return this.advance(conversationId, definition, flow.id, currentNode.id, option.id, variables)
        }
        return this.handleUnresolved(conversationId, definition, flow.id, currentNode, state, variables)
      }

      case 'list': {
        const matched = lastUserMessage
          ? matchOptions(lastUserMessage, currentNode.data?.options ?? [])
          : []

        if (matched.length > 0) {
          const allowMultiple = currentNode.data?.multiple !== false
          const chosen = allowMultiple ? matched : [matched[0]]

          if (currentNode.data?.variable) {
            variables[currentNode.data.variable] = chosen
              .map((option) => option.value ?? option.label)
              .join(', ')
            await this.saveVariables(conversationId, variables)
          }

          return this.advance(conversationId, definition, flow.id, currentNode.id, null, variables)
        }
        return this.handleUnresolved(conversationId, definition, flow.id, currentNode, state, variables)
      }

      case 'input': {
        const result = validateInput(lastUserMessage ?? '', currentNode.data?.inputType)
        if (result.valid) {
          if (currentNode.data?.variable) {
            variables[currentNode.data.variable] = result.value
            await this.saveVariables(conversationId, variables)
          }
          return this.advance(conversationId, definition, flow.id, currentNode.id, null, variables)
        }
        return this.handleUnresolved(conversationId, definition, flow.id, currentNode, state, variables)
      }

      default: {
        return this.advance(conversationId, definition, flow.id, currentNode.id, null, variables)
      }
    }
  }

  private async advance(
    conversationId: string,
    definition: FlowDefinition,
    flowId: string,
    currentNodeId: string,
    sourceHandle: string | null,
    variables: FlowVariables,
  ): Promise<BotMessageRecord[]> {
    const next = this.getNextNodeId(definition, currentNodeId, sourceHandle)
    if (!next) {
      await this.updateFlowState(conversationId, {
        flowId,
        currentNodeId,
        awaitingInput: false,
      })
      return []
    }

    return this.runFromNode(conversationId, definition, flowId, next, variables)
  }

  private async handleUnresolved(
    conversationId: string,
    definition: FlowDefinition,
    flowId: string,
    node: FlowNode,
    state: FlowEngineState,
    variables: FlowVariables,
  ): Promise<BotMessageRecord[]> {
    const maxAttempts = node.data?.maxAttempts ?? 0
    const attempts = state.attempts ?? 0

    if (attempts < maxAttempts) {
      const content = this.composeNodeMessage(node, variables, this.defaultInvalidMessage(node))
      const botMessage = await this.createBotMessage(conversationId, node, flowId, content)

      await this.updateFlowState(conversationId, {
        flowId,
        currentNodeId: node.id,
        awaitingInput: true,
        attempts: attempts + 1,
      })

      return [botMessage]
    }

    const fallbackTarget = this.getTargetByHandle(definition, node.id, FALLBACK_HANDLE)
    if (fallbackTarget) {
      return this.runFromNode(conversationId, definition, flowId, fallbackTarget, variables)
    }

    const defaultTarget = this.getDefaultTarget(definition, node.id)
    if (defaultTarget) {
      return this.runFromNode(conversationId, definition, flowId, defaultTarget, variables)
    }

    await this.updateFlowState(conversationId, {
      flowId,
      currentNodeId: node.id,
      awaitingInput: false,
    })
    return []
  }

  private async runFromNode(
    conversationId: string,
    definition: FlowDefinition,
    flowId: string,
    startNodeId: string,
    variables: FlowVariables,
  ): Promise<BotMessageRecord[]> {
    const messages: BotMessageRecord[] = []
    let currentNodeId: string | null = startNodeId
    let steps = 0

    while (currentNodeId && steps < this.maxSteps) {
      steps += 1

      const node = definition.nodes.find((item) => item.id === currentNodeId)
      if (!node) {
        break
      }

      switch (node.type) {
        case 'start': {
          const next = this.getNextNodeId(definition, node.id)
          if (!next) {
            return messages
          }
          currentNodeId = next
          continue
        }

        case 'message': {
          const content = this.composeNodeMessage(node, variables)
          messages.push(await this.createBotMessage(conversationId, node, flowId, content))

          const next = this.getNextNodeId(definition, node.id)
          if (!next) {
            await this.updateFlowState(conversationId, {
              flowId,
              currentNodeId: node.id,
              awaitingInput: false,
            })
            return messages
          }

          currentNodeId = next
          continue
        }

        case 'question':
        case 'options':
        case 'list':
        case 'input': {
          const content = this.composeNodeMessage(node, variables)
          messages.push(await this.createBotMessage(conversationId, node, flowId, content))

          await this.updateFlowState(conversationId, {
            flowId,
            currentNodeId: node.id,
            awaitingInput: true,
            attempts: 0,
          })

          return messages
        }

        case 'end': {
          const content = this.composeNodeMessage(node, variables, 'Conversa encerrada.')
          messages.push(await this.createBotMessage(conversationId, node, flowId, content))

          await this.closeConversation(conversationId, flowId, node.id)
          return messages
        }

        default:
          this.logger.warn(`Unsupported node type "${String(node.type)}" in flow ${flowId}.`)
          return messages
      }
    }

    if (steps >= this.maxSteps) {
      this.logger.warn(`Flow ${flowId} exceeded max steps in conversation ${conversationId}.`)
    }

    return messages
  }

  private async getPublishedFlow(chatbotId: string) {
    return this.prisma.flow.findFirst({
      where: { chatbotId, published: true },
      orderBy: [{ updatedAt: 'desc' }],
      select: { id: true, definition: true },
    })
  }

  private async getLastUserMessage(conversationId: string): Promise<string | null> {
    const message = await this.prisma.message.findFirst({
      where: { conversationId, role: MessageRole.USER },
      orderBy: { createdAt: 'desc' },
      select: { content: true },
    })

    return message?.content ?? null
  }

  private getNextNodeId(
    definition: FlowDefinition,
    nodeId: string,
    sourceHandle?: string | null,
  ): string | null {
    if (sourceHandle) {
      const matched = this.getTargetByHandle(definition, nodeId, sourceHandle)
      if (matched) {
        return matched
      }
    }

    return this.getDefaultTarget(definition, nodeId)
  }

  private getTargetByHandle(
    definition: FlowDefinition,
    nodeId: string,
    sourceHandle: string,
  ): string | null {
    const matched = definition.edges.find(
      (item) => item.source === nodeId && item.sourceHandle === sourceHandle,
    )
    return matched?.target ?? null
  }

  private getDefaultTarget(definition: FlowDefinition, nodeId: string): string | null {
    const outgoing = definition.edges.filter((item) => item.source === nodeId)

    const legacy = outgoing.find((item) => !item.sourceHandle)
    if (legacy) {
      return legacy.target
    }

    return outgoing[0]?.target ?? null
  }

  private composeNodeMessage(
    node: FlowNode,
    variables: FlowVariables,
    fallback?: string,
  ): string {
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

  private defaultInvalidMessage(node: FlowNode): string {
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

  private async createBotMessage(
    conversationId: string,
    node: FlowNode,
    flowId: string,
    content: string,
  ): Promise<BotMessageRecord> {
    if (!content) {
      this.logger.warn(`Node ${node.id} in flow ${flowId} has no text content.`)
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.BOT,
        content: content || '...',
        metadata: {
          flowId,
          nodeId: node.id,
          nodeType: node.type,
        } satisfies Prisma.InputJsonValue,
      },
      select: messageSelect,
    })

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })

    return message as BotMessageRecord
  }

  private async loadVariables(conversationId: string): Promise<FlowVariables> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { metadata: true },
    })

    const metadata = (conversation?.metadata ?? {}) as ConversationMetadata
    return { ...(metadata.variables ?? {}) }
  }

  private async saveVariables(conversationId: string, variables: FlowVariables) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { metadata: true },
    })

    const metadata = (conversation?.metadata ?? {}) as ConversationMetadata

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        metadata: {
          ...metadata,
          variables: { ...(metadata.variables ?? {}), ...variables },
        } as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    })
  }

  private async updateFlowState(conversationId: string, flowEngine: FlowEngineState) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { metadata: true },
    })

    const metadata = (conversation?.metadata ?? {}) as ConversationMetadata

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        metadata: {
          ...metadata,
          flowEngine,
        } as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    })
  }

  private async closeConversation(conversationId: string, flowId: string, nodeId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { metadata: true },
    })

    const metadata = (conversation?.metadata ?? {}) as ConversationMetadata

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: ConversationStatus.CLOSED,
        metadata: {
          ...metadata,
          flowEngine: {
            flowId,
            currentNodeId: nodeId,
            awaitingInput: false,
          },
        } as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    })
  }
}
