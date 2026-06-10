import { Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import type { CreateChatbotDto, UpdateChatbotDto } from './dto/chatbot.dto'

const chatbotSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { flows: true, conversations: true } },
} satisfies Prisma.ChatbotSelect

@Injectable()
export class ChatbotService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string) {
    return this.prisma.chatbot.findMany({
      where: { userId },
      select: chatbotSelect,
      orderBy: { updatedAt: 'desc' },
    })
  }

  async getForUser(chatbotId: string, userId: string) {
    const chatbot = await this.prisma.chatbot.findFirst({
      where: { id: chatbotId, userId },
      select: chatbotSelect,
    })

    if (!chatbot) {
      throw new NotFoundException('Chatbot not found.')
    }

    return chatbot
  }

  create(userId: string, dto: CreateChatbotDto) {
    return this.prisma.chatbot.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
      },
      select: chatbotSelect,
    })
  }

  async update(chatbotId: string, userId: string, dto: UpdateChatbotDto) {
    await this.getForUser(chatbotId, userId)

    return this.prisma.chatbot.update({
      where: { id: chatbotId },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
      },
      select: chatbotSelect,
    })
  }

  async remove(chatbotId: string, userId: string) {
    await this.getForUser(chatbotId, userId)
    await this.prisma.chatbot.delete({ where: { id: chatbotId } })
  }
}
