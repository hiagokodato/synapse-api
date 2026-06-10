import { Injectable, Logger } from '@nestjs/common'
import { ConversationStatus, MessageRole, type Prisma } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { parseFlowDefinition } from './flow-definition.parser'
import type {
  BotMessageRecord,
  ConversationMetadata,
  FlowDefinition,
  FlowEngineState,
  FlowNode,
} from './flow-engine.types'

const messageSelect = {
  id: true,
  conversationId: true,
  role: true,
  content: true,
  metadata: true,
  createdAt: true,
} satisfies Prisma.MessageSelect

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

    await this.updateFlowState(conversationId, {
      flowId: flow.id,
      currentNodeId: startNode.id,
      awaitingInput: false,
    })

    return this.runFromNode(conversationId, definition, flow.id, firstTarget)
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

    const nextNodeId = this.getNextNodeId(definition, state.currentNodeId)
    if (!nextNodeId) {
      await this.updateFlowState(conversationId, { ...state, awaitingInput: false })
      return []
    }

    return this.runFromNode(conversationId, definition, flow.id, nextNodeId)
  }

  private async runFromNode(
    conversationId: string,
    definition: FlowDefinition,
    flowId: string,
    startNodeId: string,
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
          const botMessage = await this.createBotMessage(conversationId, node, flowId)
          messages.push(botMessage)

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

        case 'question': {
          const botMessage = await this.createBotMessage(conversationId, node, flowId)
          messages.push(botMessage)

          await this.updateFlowState(conversationId, {
            flowId,
            currentNodeId: node.id,
            awaitingInput: true,
          })

          return messages
        }

        case 'end': {
          const botMessage = await this.createBotMessage(
            conversationId,
            node,
            flowId,
            node.data?.text?.trim() || node.data?.label?.trim() || 'Conversa encerrada.',
          )
          messages.push(botMessage)

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

  private getNextNodeId(definition: FlowDefinition, nodeId: string): string | null {
    const edge = definition.edges.find((item) => item.source === nodeId)
    return edge?.target ?? null
  }

  private nodeContent(node: FlowNode, fallback?: string): string {
    const text = node.data?.text?.trim()
    if (text) {
      return text
    }

    const label = node.data?.label?.trim()
    if (label) {
      return label
    }

    return fallback ?? ''
  }

  private async createBotMessage(
    conversationId: string,
    node: FlowNode,
    flowId: string,
    contentOverride?: string,
  ): Promise<BotMessageRecord> {
    const content = contentOverride ?? this.nodeContent(node)
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
