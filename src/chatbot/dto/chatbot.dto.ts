import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ChatbotStatus } from '@prisma/client'
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateChatbotDto {
  @ApiProperty({ example: 'Support Bot' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string

  @ApiPropertyOptional({ example: 'Handles customer support conversations' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string
}

export class UpdateChatbotDto {
  @ApiPropertyOptional({ example: 'Support Bot v2' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @ApiPropertyOptional({ enum: ChatbotStatus })
  @IsOptional()
  @IsEnum(ChatbotStatus)
  status?: ChatbotStatus
}
