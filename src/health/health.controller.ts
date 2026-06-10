import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Service health check' })
  getHealth() {
    return {
      status: 'ok',
      service: 'synapse-api',
      timestamp: new Date().toISOString(),
    }
  }
}
