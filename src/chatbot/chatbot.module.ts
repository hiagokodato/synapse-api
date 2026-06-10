import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { ChatbotController } from './chatbot.controller'
import { ChatbotService } from './chatbot.service'
import { FlowController } from './flow.controller'
import { FlowService } from './flow.service'

@Module({
  imports: [AuthModule],
  controllers: [ChatbotController, FlowController],
  providers: [ChatbotService, FlowService],
  exports: [ChatbotService, FlowService],
})
export class ChatbotModule {}
