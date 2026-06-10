import { IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  refreshToken!: string
}
