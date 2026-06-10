import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class RegisterDto {
  @ApiProperty({ example: 'Hiago Kodato' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string

  @ApiProperty({ example: 'hiago@example.com' })
  @IsEmail()
  email!: string

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string
}
