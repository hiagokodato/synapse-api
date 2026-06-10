import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { ConversationsService } from './conversations.service'
import type { CreateMessageDto } from './dto/create-message.dto'

const messageSelect = {
  id: true,
  conversationId: true,
  role: true,
  content: true,
  metadata: true,
  createdAt: true,
} satisfies Prisma.MessageSelect

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationsService,
  ) {}

  async list(chatbotId: string, conversationId: string, userId: string) {
    await this.conversations.assertAccess(chatbotId, conversationId, userId)

    return this.prisma.message.findMany({
      where: { conversationId },
      select: messageSelect,
      orderBy: { createdAt: 'asc' },
    })
  }

  async create(
    chatbotId: string,
    conversationId: string,
    userId: string,
    dto: CreateMessageDto,
  ) {
    await this.conversations.assertAccess(chatbotId, conversationId, userId)

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        content: dto.content,
        role: dto.role ?? 'USER',
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
      select: messageSelect,
    })

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })

    return message
  }
}
