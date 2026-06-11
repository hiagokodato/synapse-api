import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IntegrationProvider } from '@prisma/client'
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateIntegrationDto {
  @ApiProperty({ enum: IntegrationProvider })
  @IsEnum(IntegrationProvider)
  provider!: IntegrationProvider

  @ApiPropertyOptional({ description: 'Telegram bot token (provider TELEGRAM)' })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  botToken?: string

  @ApiPropertyOptional({ description: 'WhatsApp Cloud API access token (provider WHATSAPP)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  accessToken?: string

  @ApiPropertyOptional({ description: 'WhatsApp phone number id (provider WHATSAPP)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  phoneNumberId?: string

  @ApiPropertyOptional({ description: 'WhatsApp webhook verify token (provider WHATSAPP)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  verifyToken?: string
}

export class UpdateIntegrationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  botToken?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  accessToken?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  phoneNumberId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  verifyToken?: string
}
