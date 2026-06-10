import { ApiPropertyOptional } from '@nestjs/swagger'
import { ConversationStatus } from '@prisma/client'
import { IsEnum, IsObject, IsOptional } from 'class-validator'

export class UpdateConversationDto {
  @ApiPropertyOptional({ enum: ConversationStatus })
  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus

  @ApiPropertyOptional({ example: { channel: 'web', tags: ['support'] } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}
