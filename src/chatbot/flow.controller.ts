import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import type { AuthUser } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { CreateFlowDto, SimulateFlowDto, UpdateFlowDto, ValidateFlowDto } from './dto/flow.dto'
import { FlowService } from './flow.service'

@ApiTags('flows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chatbots/:chatbotId/flows')
export class FlowController {
  constructor(private readonly flows: FlowService) {}

  @Get()
  @ApiOperation({ summary: 'List flows for a chatbot' })
  list(@CurrentUser() user: AuthUser, @Param('chatbotId') chatbotId: string) {
    return this.flows.listForChatbot(chatbotId, user.id)
  }

  @Post()
  @ApiOperation({ summary: 'Create a flow (React Flow definition JSON)' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('chatbotId') chatbotId: string,
    @Body() dto: CreateFlowDto,
  ) {
    return this.flows.create(chatbotId, user.id, dto)
  }

  @Get(':flowId')
  @ApiOperation({ summary: 'Get a flow by id' })
  get(
    @CurrentUser() user: AuthUser,
    @Param('chatbotId') chatbotId: string,
    @Param('flowId') flowId: string,
  ) {
    return this.flows.getForChatbot(chatbotId, flowId, user.id)
  }

  @Patch(':flowId')
  @ApiOperation({ summary: 'Update a flow (publishing bumps version)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('chatbotId') chatbotId: string,
    @Param('flowId') flowId: string,
    @Body() dto: UpdateFlowDto,
  ) {
    return this.flows.update(chatbotId, flowId, user.id, dto)
  }

  @Post(':flowId/validate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Validate a flow definition (errors and warnings)' })
  validate(
    @CurrentUser() user: AuthUser,
    @Param('chatbotId') chatbotId: string,
    @Param('flowId') flowId: string,
    @Body() dto: ValidateFlowDto,
  ) {
    return this.flows.validate(chatbotId, flowId, user.id, dto.definition)
  }

  @Post(':flowId/simulate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Simulate a flow definition in memory (no persistence)' })
  simulate(
    @CurrentUser() user: AuthUser,
    @Param('chatbotId') chatbotId: string,
    @Param('flowId') flowId: string,
    @Body() dto: SimulateFlowDto,
  ) {
    return this.flows.simulate(chatbotId, flowId, user.id, dto)
  }

  @Delete(':flowId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a flow' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('chatbotId') chatbotId: string,
    @Param('flowId') flowId: string,
  ) {
    await this.flows.remove(chatbotId, flowId, user.id)
  }
}
