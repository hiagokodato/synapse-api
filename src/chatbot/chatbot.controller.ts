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
import { ChatbotService } from './chatbot.service'
import { CreateChatbotDto, UpdateChatbotDto } from './dto/chatbot.dto'

@ApiTags('chatbots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chatbots')
export class ChatbotController {
  constructor(private readonly chatbots: ChatbotService) {}

  @Get()
  @ApiOperation({ summary: 'List chatbots for the authenticated user' })
  list(@CurrentUser() user: AuthUser) {
    return this.chatbots.listForUser(user.id)
  }

  @Post()
  @ApiOperation({ summary: 'Create a chatbot' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateChatbotDto) {
    return this.chatbots.create(user.id, dto)
  }

  @Get(':chatbotId')
  @ApiOperation({ summary: 'Get a chatbot by id' })
  get(@CurrentUser() user: AuthUser, @Param('chatbotId') chatbotId: string) {
    return this.chatbots.getForUser(chatbotId, user.id)
  }

  @Patch(':chatbotId')
  @ApiOperation({ summary: 'Update a chatbot' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('chatbotId') chatbotId: string,
    @Body() dto: UpdateChatbotDto,
  ) {
    return this.chatbots.update(chatbotId, user.id, dto)
  }

  @Delete(':chatbotId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a chatbot and its flows' })
  async remove(@CurrentUser() user: AuthUser, @Param('chatbotId') chatbotId: string) {
    await this.chatbots.remove(chatbotId, user.id)
  }
}
