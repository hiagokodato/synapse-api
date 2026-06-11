import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateFlowDto {
  @ApiProperty({ example: 'Main flow' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string

  @ApiPropertyOptional({
    example: { nodes: [], edges: [] },
    description: 'React Flow graph definition',
  })
  @IsOptional()
  @IsObject()
  definition?: Record<string, unknown>
}

export class UpdateFlowDto {
  @ApiPropertyOptional({ example: 'Main flow' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string

  @ApiPropertyOptional({ example: { nodes: [], edges: [] } })
  @IsOptional()
  @IsObject()
  definition?: Record<string, unknown>

  @ApiPropertyOptional({ description: 'Publishing bumps the flow version' })
  @IsOptional()
  @IsBoolean()
  published?: boolean
}

export class ValidateFlowDto {
  @ApiPropertyOptional({
    example: { nodes: [], edges: [] },
    description: 'Definition to validate. When omitted, the stored flow is validated.',
  })
  @IsOptional()
  @IsObject()
  definition?: Record<string, unknown>
}
