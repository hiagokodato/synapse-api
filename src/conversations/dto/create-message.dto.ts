import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

import { MaxJsonSize } from '../../common/validators/max-json-size'

/** O papel (USER/BOT/SYSTEM) é definido pelo servidor, nunca pelo cliente. */
export class CreateMessageDto {
  @ApiProperty({ example: 'Hello, I need help with my order.' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string

  @ApiPropertyOptional({ example: { source: 'dashboard' } })
  @IsOptional()
  @IsObject()
  @MaxJsonSize(4_000)
  metadata?: Record<string, unknown>
}
