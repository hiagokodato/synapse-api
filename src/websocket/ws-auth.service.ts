import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

import type { AuthUser } from '../auth/auth.types'
import { ConversationsService } from '../conversations/conversations.service'
import { PrismaService } from '../prisma/prisma.service'

type JwtPayload = {
  sub: string
  email: string
  role: AuthUser['role']
}

@Injectable()
export class WsAuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationsService,
  ) {}

  async authenticate(token: string | undefined): Promise<AuthUser> {
    if (!token) {
      throw new UnauthorizedException('WebSocket token missing.')
    }

    let payload: JwtPayload
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      })
    } catch {
      throw new UnauthorizedException('Invalid WebSocket token.')
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true },
    })

    if (!user) {
      throw new UnauthorizedException('User not found.')
    }

    return user
  }

  async verifyConversationAccess(
    chatbotId: string,
    conversationId: string,
    userId: string,
  ) {
    await this.conversations.assertAccess(chatbotId, conversationId, userId)
  }
}
