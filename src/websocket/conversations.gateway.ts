import { Logger, UsePipes, ValidationPipe } from '@nestjs/common'
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets'
import { MessageRole } from '@prisma/client'
import type { Server, Socket } from 'socket.io'

import type { AuthUser } from '../auth/auth.types'
import { MessagesService } from '../conversations/messages.service'
import { FlowEngineService } from '../flow-engine/flow-engine.service'
import { JoinConversationPayload, SendMessagePayload } from './dto/ws-payloads.dto'
import { WsAuthService } from './ws-auth.service'

type AuthedSocket = Socket & { user?: AuthUser }

// CORS do socket.io: definido em main.ts (CorsIoAdapter), com as mesmas origens do HTTP.
@WebSocketGateway({ namespace: '/realtime' })
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new WsException(errors.flatMap((error) => Object.values(error.constraints ?? {})).join('; ')),
  }),
)
export class ConversationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ConversationsGateway.name)

  @WebSocketServer()
  server!: Server

  constructor(
    private readonly wsAuth: WsAuthService,
    private readonly messages: MessagesService,
    private readonly flowEngine: FlowEngineService,
  ) {}

  async handleConnection(client: AuthedSocket) {
    try {
      const token = this.extractToken(client)
      client.user = await this.wsAuth.authenticate(token)
      this.logger.debug(`Client connected: ${client.id} (${client.user.email})`)
    } catch (error) {
      this.logger.warn(`Rejected connection ${client.id}: ${String(error)}`)
      client.disconnect(true)
    }
  }

  handleDisconnect(client: AuthedSocket) {
    this.logger.debug(`Client disconnected: ${client.id}`)
  }

  @SubscribeMessage('conversation:join')
  async joinConversation(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: JoinConversationPayload,
  ) {
    const user = this.requireUser(client)
    await this.wsAuth.verifyConversationAccess(
      payload.chatbotId,
      payload.conversationId,
      user.id,
    )

    const room = this.roomName(payload.conversationId)
    await client.join(room)

    return { ok: true, room }
  }

  @SubscribeMessage('message:send')
  async sendMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    const user = this.requireUser(client)
    await this.wsAuth.verifyConversationAccess(
      payload.chatbotId,
      payload.conversationId,
      user.id,
    )

    const message = await this.messages.create(
      payload.chatbotId,
      payload.conversationId,
      user.id,
      { content: payload.content },
      MessageRole.USER,
    )

    const room = this.roomName(payload.conversationId)
    this.server.to(room).emit('message:new', message)

    const botMessages = await this.flowEngine.handleUserMessage(
      payload.chatbotId,
      payload.conversationId,
    )

    for (const botMessage of botMessages) {
      this.server.to(room).emit('message:new', botMessage)
    }

    return message
  }

  private requireUser(client: AuthedSocket): AuthUser {
    if (!client.user) {
      throw new Error('Unauthenticated socket.')
    }
    return client.user
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken
    }

    // Token por query string não é aceito: URLs vão parar em logs de proxy e servidor.
    const header = client.handshake.headers.authorization
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7)
    }

    return undefined
  }

  private roomName(conversationId: string) {
    return `conversation:${conversationId}`
  }
}
