import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'

import { parseFlowDefinition } from '../flow-engine/flow-definition.parser'
import {
  simulateReply,
  simulateStart,
  type SimulationState,
} from '../flow-engine/flow-runner'
import { validateFlowDefinition } from '../flow-engine/flow-validator'
import { PrismaService } from '../prisma/prisma.service'
import { ChatbotService } from './chatbot.service'
import type { CreateFlowDto, SimulateFlowDto, UpdateFlowDto } from './dto/flow.dto'

const flowSelect = {
  id: true,
  chatbotId: true,
  name: true,
  definition: true,
  version: true,
  published: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FlowSelect

@Injectable()
export class FlowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatbots: ChatbotService,
  ) {}

  async listForChatbot(chatbotId: string, userId: string) {
    await this.chatbots.getForUser(chatbotId, userId)

    return this.prisma.flow.findMany({
      where: { chatbotId },
      select: flowSelect,
      orderBy: [{ published: 'desc' }, { updatedAt: 'desc' }],
    })
  }

  async getForChatbot(chatbotId: string, flowId: string, userId: string) {
    await this.chatbots.getForUser(chatbotId, userId)

    const flow = await this.prisma.flow.findFirst({
      where: { id: flowId, chatbotId },
      select: flowSelect,
    })

    if (!flow) {
      throw new NotFoundException('Flow not found.')
    }

    return flow
  }

  async create(chatbotId: string, userId: string, dto: CreateFlowDto) {
    await this.chatbots.getForUser(chatbotId, userId)

    return this.prisma.flow.create({
      data: {
        chatbotId,
        name: dto.name,
        definition: (dto.definition ?? {}) as Prisma.InputJsonValue,
      },
      select: flowSelect,
    })
  }

  async update(chatbotId: string, flowId: string, userId: string, dto: UpdateFlowDto) {
    const existing = await this.getForChatbot(chatbotId, flowId, userId)

    if (dto.published === true) {
      const target = dto.definition ?? existing.definition
      const validation = validateFlowDefinition(target)
      if (!validation.valid) {
        throw new BadRequestException({
          message: 'O fluxo não pode ser publicado porque contém erros.',
          issues: validation.issues,
        })
      }
    }

    const shouldBumpVersion = dto.published === true && !existing.published

    return this.prisma.flow.update({
      where: { id: flowId },
      data: {
        name: dto.name,
        definition: dto.definition as Prisma.InputJsonValue | undefined,
        published: dto.published,
        version: shouldBumpVersion ? { increment: 1 } : undefined,
      },
      select: flowSelect,
    })
  }

  async remove(chatbotId: string, flowId: string, userId: string) {
    await this.getForChatbot(chatbotId, flowId, userId)
    await this.prisma.flow.delete({ where: { id: flowId } })
  }

  async validate(
    chatbotId: string,
    flowId: string,
    userId: string,
    definition?: Record<string, unknown>,
  ) {
    const flow = await this.getForChatbot(chatbotId, flowId, userId)
    return validateFlowDefinition(definition ?? flow.definition)
  }

  async simulate(chatbotId: string, flowId: string, userId: string, dto: SimulateFlowDto) {
    const flow = await this.getForChatbot(chatbotId, flowId, userId)

    const definition = parseFlowDefinition(dto.definition ?? flow.definition)
    if (!definition) {
      throw new BadRequestException('A definição do fluxo é inválida e não pode ser simulada.')
    }

    const isReply = typeof dto.message === 'string' && !!dto.state
    if (!isReply) {
      return simulateStart(definition)
    }

    const state = dto.state as SimulationState
    return simulateReply(definition, state, dto.variables ?? {}, dto.message ?? '')
  }
}
