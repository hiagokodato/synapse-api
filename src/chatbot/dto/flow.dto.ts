import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

import { MaxJsonSize } from '../../common/validators/max-json-size'

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
  @MaxJsonSize(150_000)
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
  @MaxJsonSize(150_000)
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
  @MaxJsonSize(150_000)
  definition?: Record<string, unknown>
}

export class SimulateFlowDto {
  @ApiPropertyOptional({
    example: { nodes: [], edges: [] },
    description: 'Draft definition to simulate. When omitted, the stored flow is used.',
  })
  @IsOptional()
  @IsObject()
  @MaxJsonSize(150_000)
  definition?: Record<string, unknown>

  @ApiPropertyOptional({
    description: 'User reply for the current step. When omitted, the simulation (re)starts.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string

  @ApiPropertyOptional({
    description: 'Simulation state returned by the previous call. Required to send a reply.',
  })
  @IsOptional()
  @IsObject()
  @MaxJsonSize(2_000)
  state?: { currentNodeId: string; awaitingInput: boolean; attempts: number }

  @ApiPropertyOptional({
    description: 'Variables captured so far in the simulation.',
  })
  @IsOptional()
  @IsObject()
  @MaxJsonSize(20_000)
  variables?: Record<string, string>
}
