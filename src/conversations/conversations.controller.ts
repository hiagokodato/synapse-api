import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import type { AuthUser } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { ConversationsService } from './conversations.service'
import { CreateConversationDto } from './dto/create-conversation.dto'
import { UpdateConversationDto } from './dto/update-conversation.dto'

@ApiTags('conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chatbots/:chatbotId/conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: 'List conversations for a chatbot' })
  list(@CurrentUser() user: AuthUser, @Param('chatbotId') chatbotId: string) {
    return this.conversations.listForChatbot(chatbotId, user.id)
  }

  @Post()
  @ApiOperation({ summary: 'Start a new conversation' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('chatbotId') chatbotId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return this.conversations.create(chatbotId, user.id, dto)
  }

  @Get(':conversationId')
  @ApiOperation({ summary: 'Get conversation with recent messages' })
  get(
    @CurrentUser() user: AuthUser,
    @Param('chatbotId') chatbotId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.conversations.getForChatbot(chatbotId, conversationId, user.id)
  }

  @Patch(':conversationId')
  @ApiOperation({ summary: 'Update conversation status or metadata' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('chatbotId') chatbotId: string,
    @Param('conversationId') conversationId: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.conversations.update(chatbotId, conversationId, user.id, dto)
  }
}
