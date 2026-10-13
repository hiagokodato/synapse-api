import { IsString, MaxLength, MinLength } from 'class-validator'

export class JoinConversationPayload {
  @IsString()
  @MaxLength(64)
  chatbotId!: string

  @IsString()
  @MaxLength(64)
  conversationId!: string
}

/** O papel da mensagem não vem do cliente: quem envia pelo socket é sempre USER. */
export class SendMessagePayload extends JoinConversationPayload {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string
}
