import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { ChatbotModule } from '../chatbot/chatbot.module'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsService } from './analytics.service'

@Module({
  imports: [AuthModule, ChatbotModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
