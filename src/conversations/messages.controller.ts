import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import type { AuthUser } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { CreateMessageDto } from './dto/create-message.dto'
import { MessagesService } from './messages.service'

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chatbots/:chatbotId/conversations/:conversationId/messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  @ApiOperation({ summary: 'List messages in a conversation' })
  list(
    @CurrentUser() user: AuthUser,
    @Param('chatbotId') chatbotId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.messages.list(chatbotId, conversationId, user.id)
  }

  @Post()
  @ApiOperation({ summary: 'Send a message (REST fallback)' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('chatbotId') chatbotId: string,
    @Param('conversationId') conversationId: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messages.create(chatbotId, conversationId, user.id, dto)
  }
}
