import { Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'

import { ChatbotService } from '../chatbot/chatbot.service'
import { FlowEngineService } from '../flow-engine/flow-engine.service'
import { PrismaService } from '../prisma/prisma.service'
import type { CreateConversationDto } from './dto/create-conversation.dto'
import type { UpdateConversationDto } from './dto/update-conversation.dto'

const conversationSelect = {
  id: true,
  chatbotId: true,
  externalId: true,
  status: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { messages: true } },
} satisfies Prisma.ConversationSelect

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatbots: ChatbotService,
    private readonly flowEngine: FlowEngineService,
  ) {}

  async listForChatbot(chatbotId: string, userId: string) {
    await this.chatbots.getForUser(chatbotId, userId)

    return this.prisma.conversation.findMany({
      where: { chatbotId },
      select: conversationSelect,
      orderBy: { updatedAt: 'desc' },
    })
  }

  async getForChatbot(chatbotId: string, conversationId: string, userId: string) {
    await this.chatbots.getForUser(chatbotId, userId)

    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, chatbotId },
      select: {
        ...conversationSelect,
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50,
          select: {
            id: true,
            role: true,
            content: true,
            metadata: true,
            createdAt: true,
          },
        },
      },
    })

    if (!conversation) {
      throw new NotFoundException('Conversation not found.')
    }

    return conversation
  }

  async create(chatbotId: string, userId: string, dto: CreateConversationDto) {
    await this.chatbots.getForUser(chatbotId, userId)

    const conversation = await this.prisma.conversation.create({
      data: {
        chatbotId,
        externalId: dto.externalId,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
      select: conversationSelect,
    })

    await this.flowEngine.startConversation(chatbotId, conversation.id)

    return conversation
  }

  async update(
    chatbotId: string,
    conversationId: string,
    userId: string,
    dto: UpdateConversationDto,
  ) {
    await this.getForChatbot(chatbotId, conversationId, userId)

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: dto.status,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
      select: conversationSelect,
    })
  }

  async assertAccess(chatbotId: string, conversationId: string, userId: string) {
    await this.getForChatbot(chatbotId, conversationId, userId)
  }
}
