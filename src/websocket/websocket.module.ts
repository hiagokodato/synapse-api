import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'

import { ConversationsModule } from '../conversations/conversations.module'
import { ConversationsGateway } from './conversations.gateway'
import { WsAuthService } from './ws-auth.service'

@Module({
  imports: [
    ConfigModule,
    ConversationsModule,
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
