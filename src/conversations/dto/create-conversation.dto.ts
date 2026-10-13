import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator'

import { MaxJsonSize } from '../../common/validators/max-json-size'

export class CreateConversationDto {
  @ApiPropertyOptional({ example: 'whatsapp:+5511999999999' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalId?: string

  @ApiPropertyOptional({ example: { channel: 'web' } })
  @IsOptional()
  @IsObject()
  @MaxJsonSize(4_000)
  metadata?: Record<string, unknown>
}
