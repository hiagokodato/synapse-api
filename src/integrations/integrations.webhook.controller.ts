import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import { IntegrationProvider } from '@prisma/client'
import { SkipThrottle } from '@nestjs/throttler'

import { IntegrationsService } from './integrations.service'
import { parseTelegramUpdate } from './providers/telegram.client'
import { parseWhatsappMessages } from './providers/whatsapp.client'

@ApiExcludeController()
@SkipThrottle()
@Controller('integrations')
export class IntegrationsWebhookController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Post('telegram/:secret')
  @HttpCode(200)
  async telegram(
    @Param('secret') secret: string,
    @Headers('x-telegram-bot-api-secret-token') secretHeader: string | undefined,
    @Body() body: unknown,
  ) {
    const integration = await this.integrations.resolveBySecret(IntegrationProvider.TELEGRAM, secret)
    if (!integration) {
      return { ok: true }
    }

    if (secretHeader && secretHeader !== integration.webhookSecret) {
      return { ok: true }
    }

    const update = parseTelegramUpdate(body)
    if (update) {
      await this.integrations.processInbound(integration, update.chatId, update.text)
    }

    return { ok: true }
  }

  @Get('whatsapp/:secret')
  async verifyWhatsapp(
    @Param('secret') secret: string,
    @Query() query: Record<string, string>,
  ): Promise<string> {
    const integration = await this.integrations.resolveBySecret(
      IntegrationProvider.WHATSAPP,
      secret,
    )

    const mode = query['hub.mode']
    const token = query['hub.verify_token']
    const challenge = query['hub.challenge']

    if (integration && mode === 'subscribe' && this.integrations.matchesWhatsappVerifyToken(integration, token)) {
      return challenge ?? ''
    }

    throw new ForbiddenException('Verification failed.')
  }

  @Post('whatsapp/:secret')
  @HttpCode(200)
  async whatsapp(@Param('secret') secret: string, @Body() body: unknown) {
    const integration = await this.integrations.resolveBySecret(
      IntegrationProvider.WHATSAPP,
      secret,
    )
    if (!integration) {
      return { ok: true }
    }

    for (const message of parseWhatsappMessages(body)) {
      await this.integrations.processInbound(integration, message.from, message.text)
    }

    return { ok: true }
  }
}
