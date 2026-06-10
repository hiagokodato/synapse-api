import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { ChatbotModule } from '../chatbot/chatbot.module'
import { ConversationsController } from './conversations.controller'
import { ConversationsService } from './conversations.service'
import { MessagesController } from './messages.controller'
import { MessagesService } from './messages.service'

@Module({
  imports: [AuthModule, ChatbotModule],
  controllers: [ConversationsController, MessagesController],
  providers: [ConversationsService, MessagesService],
  exports: [ConversationsService, MessagesService],
})
export class ConversationsModule {}
