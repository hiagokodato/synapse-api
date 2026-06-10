import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'

import { ConversationsModule } from '../conversations/conversations.module'
import { FlowEngineModule } from '../flow-engine/flow-engine.module'
import { ConversationsGateway } from './conversations.gateway'
import { WsAuthService } from './ws-auth.service'

@Module({
  imports: [
    ConfigModule,
    ConversationsModule,
    FlowEngineModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwt.accessSecret'),
      }),
    }),
  ],
  providers: [ConversationsGateway, WsAuthService],
})
export class WebsocketModule {}
