import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { ChatbotModule } from '../chatbot/chatbot.module'
import { FlowEngineModule } from '../flow-engine/flow-engine.module'
import { IntegrationsController } from './integrations.controller'
import { IntegrationsService } from './integrations.service'
import { IntegrationsWebhookController } from './integrations.webhook.controller'

@Module({
  imports: [AuthModule, ChatbotModule, FlowEngineModule],
  controllers: [IntegrationsController, IntegrationsWebhookController],
  providers: [IntegrationsService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
