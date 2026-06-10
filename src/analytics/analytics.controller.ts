import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import type { AuthUser } from '../auth/auth.types'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { AnalyticsService } from './analytics.service'
import { AnalyticsQueryDto } from './dto/analytics-query.dto'

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('analytics/overview')
  @ApiOperation({ summary: 'Dashboard metrics for all chatbots owned by the user' })
  getOverview(@CurrentUser() user: AuthUser) {
    return this.analytics.getOverview(user.id)
  }

  @Get('chatbots/:chatbotId/analytics')
  @ApiOperation({ summary: 'Metrics for a specific chatbot' })
  getChatbotAnalytics(
    @CurrentUser() user: AuthUser,
    @Param('chatbotId') chatbotId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analytics.getForChatbot(chatbotId, user.id, query.days ?? 7)
  }
}
