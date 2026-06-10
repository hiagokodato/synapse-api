import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { MessageRole } from '@prisma/client'
import { IsEnum, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateMessageDto {
  @ApiProperty({ example: 'Hello, I need help with my order.' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string

  @ApiPropertyOptional({ enum: MessageRole, default: MessageRole.USER })
  @IsOptional()
  @IsEnum(MessageRole)
  role?: MessageRole

  @ApiPropertyOptional({ example: { source: 'dashboard' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}
