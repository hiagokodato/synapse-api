import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'

import { AnalyticsModule } from './analytics/analytics.module'
import { AuthModule } from './auth/auth.module'
import { ChatbotModule } from './chatbot/chatbot.module'
import { ConversationsModule } from './conversations/conversations.module'
import { GlobalExceptionFilter } from './common/filters/global-exception.filter'
import configuration from './config/configuration'
import { HealthModule } from './health/health.module'
import { IntegrationsModule } from './integrations/integrations.module'
import { PrismaModule } from './prisma/prisma.module'
import { WebsocketModule } from './websocket/websocket.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('throttle.ttl', 60_000),
          limit: config.get<number>('throttle.limit', 100),
        },
      ],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    ChatbotModule,
    ConversationsModule,
    AnalyticsModule,
    IntegrationsModule,
    WebsocketModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
