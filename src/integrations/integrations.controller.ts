import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import type { AuthUser } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto/integration.dto'
import { IntegrationsService } from './integrations.service'

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chatbots/:chatbotId/integrations')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get()
  @ApiOperation({ summary: 'List channel integrations for a chatbot' })
  list(@CurrentUser() user: AuthUser, @Param('chatbotId') chatbotId: string) {
    return this.integrations.list(chatbotId, user.id)
  }

  @Post()
  @ApiOperation({ summary: 'Connect a channel (Telegram or WhatsApp)' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('chatbotId') chatbotId: string,
    @Body() dto: CreateIntegrationDto,
  ) {
    return this.integrations.create(chatbotId, user.id, dto)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update credentials or enable/disable an integration' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('chatbotId') chatbotId: string,
    @Param('id') id: string,
    @Body() dto: UpdateIntegrationDto,
  ) {
    return this.integrations.update(chatbotId, id, user.id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove an integration' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('chatbotId') chatbotId: string,
    @Param('id') id: string,
  ) {
    await this.integrations.remove(chatbotId, id, user.id)
  }

  @Post(':id/telegram/webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Register this integration as the Telegram webhook' })
  registerTelegramWebhook(
    @CurrentUser() user: AuthUser,
    @Param('chatbotId') chatbotId: string,
    @Param('id') id: string,
  ) {
    return this.integrations.registerTelegramWebhook(chatbotId, id, user.id)
  }
}
