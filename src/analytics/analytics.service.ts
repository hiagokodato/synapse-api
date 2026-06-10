import { Injectable } from '@nestjs/common'
import { ChatbotStatus, ConversationStatus, MessageRole } from '@prisma/client'

import { ChatbotService } from '../chatbot/chatbot.service'
import { PrismaService } from '../prisma/prisma.service'
import type { ChatbotAnalytics, DailyCount, OverviewAnalytics } from './analytics.types'

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatbots: ChatbotService,
  ) {}

  async getOverview(userId: string): Promise<OverviewAnalytics> {
    const chatbotIds = await this.getUserChatbotIds(userId)

    if (chatbotIds.length === 0) {
      return this.emptyOverview()
    }

    const [
      chatbotsByStatus,
      conversationsByStatus,
      messagesByRole,
      flowsTotal,
      flowsPublished,
    ] = await Promise.all([
      this.prisma.chatbot.groupBy({
        by: ['status'],
        where: { userId },
        _count: { _all: true },
      }),
      this.prisma.conversation.groupBy({
        by: ['status'],
        where: { chatbotId: { in: chatbotIds } },
        _count: { _all: true },
      }),
      this.prisma.message.groupBy({
        by: ['role'],
        where: { conversation: { chatbotId: { in: chatbotIds } } },
        _count: { _all: true },
      }),
      this.prisma.flow.count({ where: { chatbotId: { in: chatbotIds } } }),
      this.prisma.flow.count({
        where: { chatbotId: { in: chatbotIds }, published: true },
      }),
    ])

    const chatbotCounts = this.mapChatbotStatus(chatbotsByStatus)
    const conversationCounts = this.mapConversationStatus(conversationsByStatus)
    const messageCounts = this.mapMessageRole(messagesByRole)

    return {
      chatbots: chatbotCounts,
      conversations: conversationCounts,
      messages: messageCounts,
      flows: {
        total: flowsTotal,
        published: flowsPublished,
      },
    }
  }

  async getForChatbot(
    chatbotId: string,
    userId: string,
    days: number,
  ): Promise<ChatbotAnalytics> {
    const chatbot = await this.chatbots.getForUser(chatbotId, userId)

    const [conversationsByStatus, messagesByRole, flowsTotal, flowsPublished, recentMessages] =
      await Promise.all([
        this.prisma.conversation.groupBy({
          by: ['status'],
          where: { chatbotId },
          _count: { _all: true },
        }),
        this.prisma.message.groupBy({
          by: ['role'],
          where: { conversation: { chatbotId } },
          _count: { _all: true },
        }),
        this.prisma.flow.count({ where: { chatbotId } }),
        this.prisma.flow.count({ where: { chatbotId, published: true } }),
        this.prisma.message.findMany({
          where: {
            conversation: { chatbotId },
            createdAt: { gte: this.daysAgo(days) },
          },
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
        }),
      ])

    return {
      chatbotId: chatbot.id,
      chatbotName: chatbot.name,
      status: chatbot.status,
      conversations: this.mapConversationStatus(conversationsByStatus),
      messages: this.mapMessageRole(messagesByRole),
      flows: {
        total: flowsTotal,
        published: flowsPublished,
      },
      messagesByDay: this.groupMessagesByDay(recentMessages, days),
    }
  }

  private async getUserChatbotIds(userId: string): Promise<string[]> {
    const chatbots = await this.prisma.chatbot.findMany({
      where: { userId },
      select: { id: true },
    })
    return chatbots.map((c) => c.id)
  }

  private emptyOverview(): OverviewAnalytics {
    return {
      chatbots: { total: 0, active: 0, draft: 0, archived: 0 },
      conversations: { total: 0, open: 0, closed: 0 },
      messages: { total: 0, user: 0, bot: 0, system: 0 },
      flows: { total: 0, published: 0 },
    }
  }

  private mapChatbotStatus(
    rows: { status: ChatbotStatus; _count: { _all: number } }[],
  ) {
    const counts = {
      total: 0,
      active: 0,
      draft: 0,
      archived: 0,
    }

    for (const row of rows) {
      counts.total += row._count._all
      if (row.status === ChatbotStatus.ACTIVE) counts.active = row._count._all
      if (row.status === ChatbotStatus.DRAFT) counts.draft = row._count._all
      if (row.status === ChatbotStatus.ARCHIVED) counts.archived = row._count._all
    }

    return counts
  }

  private mapConversationStatus(
    rows: { status: ConversationStatus; _count: { _all: number } }[],
  ) {
    const counts = { total: 0, open: 0, closed: 0 }

    for (const row of rows) {
      counts.total += row._count._all
      if (row.status === ConversationStatus.OPEN) counts.open = row._count._all
      if (row.status === ConversationStatus.CLOSED) counts.closed = row._count._all
    }

    return counts
  }

  private mapMessageRole(rows: { role: MessageRole; _count: { _all: number } }[]) {
    const counts = { total: 0, user: 0, bot: 0, system: 0 }

    for (const row of rows) {
      counts.total += row._count._all
      if (row.role === MessageRole.USER) counts.user = row._count._all
      if (row.role === MessageRole.BOT) counts.bot = row._count._all
      if (row.role === MessageRole.SYSTEM) counts.system = row._count._all
    }

    return counts
  }

  private groupMessagesByDay(
    messages: { createdAt: Date }[],
    days: number,
  ): DailyCount[] {
    const buckets = new Map<string, number>()

    for (let i = days - 1; i >= 0; i -= 1) {
      const date = this.formatDate(this.daysAgo(i))
      buckets.set(date, 0)
    }

    for (const message of messages) {
      const date = this.formatDate(message.createdAt)
      if (buckets.has(date)) {
        buckets.set(date, (buckets.get(date) ?? 0) + 1)
      }
    }

    return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }))
  }

  private daysAgo(days: number): Date {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - days)
    return date
  }

  private formatDate(value: Date): string {
    return value.toISOString().slice(0, 10)
  }
}
