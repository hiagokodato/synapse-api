import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  ConversationStatus,
  IntegrationProvider,
  MessageRole,
  Prisma,
  type Integration,
} from '@prisma/client'

import { ChatbotService } from '../chatbot/chatbot.service'
import { CredentialsCipher } from '../common/crypto/credentials-cipher'
import { FlowEngineService } from '../flow-engine/flow-engine.service'
import { PrismaService } from '../prisma/prisma.service'
import type { CreateIntegrationDto, UpdateIntegrationDto } from './dto/integration.dto'
import {
  asTelegramCredentials,
  asWhatsappCredentials,
  type WhatsappCredentials,
} from './integration.types'
import {
  getTelegramBotId,
  sendTelegramMessage,
  setTelegramWebhook,
} from './providers/telegram.client'
import { sendWhatsappMessage } from './providers/whatsapp.client'

/** Mensagens que chegam dos canais são cortadas neste tamanho (mesmo limite do CreateMessageDto). */
const MAX_INBOUND_TEXT = 4000

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name)
  private readonly cipher: CredentialsCipher

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly chatbots: ChatbotService,
    private readonly flowEngine: FlowEngineService,
  ) {
    this.cipher = new CredentialsCipher(this.config.get<string>('credentialsEncryptionKey', ''))
  }

  async list(chatbotId: string, userId: string) {
    await this.chatbots.getForUser(chatbotId, userId)
    const integrations = await this.prisma.integration.findMany({
      where: { chatbotId },
      orderBy: { createdAt: 'asc' },
    })
    return integrations.map((integration) => this.sanitize(integration))
  }

  async create(chatbotId: string, userId: string, dto: CreateIntegrationDto) {
    await this.chatbots.getForUser(chatbotId, userId)

    const credentials = this.buildCredentials(dto.provider, dto)
    const webhookSecret = randomBytes(24).toString('hex')
    const externalRef = await this.resolveExternalRef(dto.provider, credentials)

    try {
      const integration = await this.prisma.integration.create({
        data: {
          chatbotId,
          provider: dto.provider,
          credentials: this.cipher.encrypt(credentials) as Prisma.InputJsonValue,
          webhookSecret,
          externalRef,
        },
      })
      return this.sanitize(integration)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Já existe uma integração desse tipo para este chatbot.')
      }
      throw error
    }
  }

  async update(chatbotId: string, id: string, userId: string, dto: UpdateIntegrationDto) {
    const existing = await this.getOwned(chatbotId, id, userId)

    const data: Prisma.IntegrationUpdateInput = {}

    if (dto.enabled !== undefined) {
      data.enabled = dto.enabled
    }

    const credentials = this.mergeCredentials(existing, dto)
    if (credentials) {
      data.credentials = this.cipher.encrypt(credentials) as Prisma.InputJsonValue
      data.externalRef = await this.resolveExternalRef(existing.provider, credentials)
    }

    const integration = await this.prisma.integration.update({ where: { id }, data })
    return this.sanitize(integration)
  }

  async remove(chatbotId: string, id: string, userId: string) {
    await this.getOwned(chatbotId, id, userId)
    await this.prisma.integration.delete({ where: { id } })
  }

  async registerTelegramWebhook(chatbotId: string, id: string, userId: string) {
    const integration = await this.getOwned(chatbotId, id, userId)
    if (integration.provider !== IntegrationProvider.TELEGRAM) {
      throw new BadRequestException('Esta ação é exclusiva para integrações do Telegram.')
    }

    const url = this.webhookUrl(integration.provider, integration.webhookSecret)
    if (!url) {
      throw new BadRequestException('Configure PUBLIC_BASE_URL para registrar o webhook.')
    }

    const { botToken } = this.telegramCredentials(integration)
    await setTelegramWebhook(botToken, url, integration.webhookSecret)
    return { url }
  }

  async resolveBySecret(provider: IntegrationProvider, secret: string): Promise<Integration | null> {
    if (!secret) {
      return null
    }
    const integration = await this.prisma.integration.findUnique({
      where: { webhookSecret: secret },
    })
    if (!integration || integration.provider !== provider || !integration.enabled) {
      return null
    }
    return integration
  }

  matchesWhatsappVerifyToken(integration: Integration, token: string | undefined): boolean {
    if (!token) {
      return false
    }
    return safeEqual(this.whatsappCredentials(integration).verifyToken, token)
  }

  async processInbound(integration: Integration, sender: string, text: string): Promise<void> {
    const channel = this.channelName(integration.provider)
    const externalId = `${channel}:${sender}`

    const previous = await this.prisma.conversation.findFirst({
      where: { chatbotId: integration.chatbotId, externalId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    })

    const isNew = !previous || previous.status === ConversationStatus.CLOSED

    const conversation = isNew
      ? await this.prisma.conversation.create({
          data: {
            chatbotId: integration.chatbotId,
            externalId,
            metadata: { channel, integrationId: integration.id } as Prisma.InputJsonValue,
          },
          select: { id: true },
        })
      : previous!

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.USER,
        content: text.slice(0, MAX_INBOUND_TEXT),
        metadata: { channel } as Prisma.InputJsonValue,
      },
    })
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    })

    const botMessages = isNew
      ? await this.flowEngine.startConversation(integration.chatbotId, conversation.id)
      : await this.flowEngine.handleUserMessage(integration.chatbotId, conversation.id)

    for (const message of botMessages) {
      try {
        await this.deliver(integration, sender, message.content)
      } catch (error) {
        this.logger.error(`Failed to deliver message via ${channel}: ${String(error)}`)
      }
    }
  }

  /** Telegram envia o secret_token registrado no setWebhook; sem ele (ou diferente), a requisição é descartada. */
  matchesTelegramSecret(integration: Integration, header: string | undefined): boolean {
    return !!header && safeEqual(header, integration.webhookSecret)
  }

  /** Confere X-Hub-Signature-256 = HMAC-SHA256(corpo bruto, App Secret) da Meta. */
  matchesWhatsappSignature(
    integration: Integration,
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): boolean {
    const { appSecret } = this.whatsappCredentials(integration)
    if (!appSecret) {
      this.logger.warn(`WhatsApp integration ${integration.id} has no appSecret; webhook rejected.`)
      return false
    }
    if (!rawBody || !signature?.startsWith('sha256=')) {
      return false
    }
    const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex')
    return safeEqual(signature.slice('sha256='.length), expected)
  }

  private telegramCredentials(integration: Integration) {
    return asTelegramCredentials(this.cipher.decrypt(integration.credentials))
  }

  private whatsappCredentials(integration: Integration) {
    return asWhatsappCredentials(this.cipher.decrypt(integration.credentials))
  }

  private async deliver(integration: Integration, to: string, text: string): Promise<void> {
    if (integration.provider === IntegrationProvider.TELEGRAM) {
      const { botToken } = this.telegramCredentials(integration)
      await sendTelegramMessage(botToken, to, text)
      return
    }

    const { accessToken, phoneNumberId } = this.whatsappCredentials(integration)
    await sendWhatsappMessage({ accessToken, phoneNumberId }, to, text)
  }

  private async getOwned(chatbotId: string, id: string, userId: string): Promise<Integration> {
    await this.chatbots.getForUser(chatbotId, userId)
    const integration = await this.prisma.integration.findFirst({ where: { id, chatbotId } })
    if (!integration) {
      throw new NotFoundException('Integração não encontrada.')
    }
    return integration
  }

  private buildCredentials(
    provider: IntegrationProvider,
    dto: CreateIntegrationDto,
  ): Record<string, string> {
    if (provider === IntegrationProvider.TELEGRAM) {
      if (!dto.botToken) {
        throw new BadRequestException('botToken é obrigatório para o Telegram.')
      }
      return { botToken: dto.botToken }
    }

    if (!dto.accessToken || !dto.phoneNumberId || !dto.verifyToken || !dto.appSecret) {
      throw new BadRequestException(
        'accessToken, phoneNumberId, verifyToken e appSecret são obrigatórios para o WhatsApp.',
      )
    }
    return {
      accessToken: dto.accessToken,
      phoneNumberId: dto.phoneNumberId,
      verifyToken: dto.verifyToken,
      appSecret: dto.appSecret,
    }
  }

  private mergeCredentials(
    existing: Integration,
    dto: UpdateIntegrationDto,
  ): Record<string, string> | null {
    if (existing.provider === IntegrationProvider.TELEGRAM) {
      if (dto.botToken === undefined) {
        return null
      }
      return { botToken: dto.botToken }
    }

    if (
      dto.accessToken === undefined &&
      dto.phoneNumberId === undefined &&
      dto.verifyToken === undefined &&
      dto.appSecret === undefined
    ) {
      return null
    }

    const current = this.whatsappCredentials(existing)
    return {
      accessToken: dto.accessToken ?? current.accessToken,
      phoneNumberId: dto.phoneNumberId ?? current.phoneNumberId,
      verifyToken: dto.verifyToken ?? current.verifyToken,
      appSecret: dto.appSecret ?? current.appSecret,
    }
  }

  private async resolveExternalRef(
    provider: IntegrationProvider,
    credentials: Record<string, string>,
  ): Promise<string | null> {
    if (provider === IntegrationProvider.WHATSAPP) {
      return (credentials as WhatsappCredentials).phoneNumberId
    }
    return getTelegramBotId(credentials.botToken)
  }

  private channelName(provider: IntegrationProvider): string {
    return provider === IntegrationProvider.TELEGRAM ? 'telegram' : 'whatsapp'
  }

  private webhookUrl(provider: IntegrationProvider, secret: string): string | null {
    const base = this.config.get<string>('publicUrl')
    if (!base) {
      return null
    }
    return `${base}/v1/integrations/${this.channelName(provider)}/${secret}`
  }

  private sanitize(integration: Integration) {
    return {
      id: integration.id,
      chatbotId: integration.chatbotId,
      provider: integration.provider,
      enabled: integration.enabled,
      externalRef: integration.externalRef,
      webhookUrl: this.webhookUrl(integration.provider, integration.webhookSecret),
      credentials: this.maskCredentials(integration),
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    }
  }

  private maskCredentials(integration: Integration) {
    if (integration.provider === IntegrationProvider.TELEGRAM) {
      const { botToken } = this.telegramCredentials(integration)
      return { botToken: this.mask(botToken) }
    }

    const { accessToken, phoneNumberId, verifyToken, appSecret } = this.whatsappCredentials(integration)
    return {
      accessToken: this.mask(accessToken),
      phoneNumberId,
      verifyToken: this.mask(verifyToken),
      appSecret: this.mask(appSecret),
    }
  }

  private mask(value: string): string {
    if (!value) {
      return ''
    }
    if (value.length <= 8) {
      return '••••'
    }
    return `${value.slice(0, 4)}••••${value.slice(-4)}`
  }
}
