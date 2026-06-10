import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../common/decorators/current-user.decorator'
import { AuthService } from './auth.service'
import type { AuthUser } from './auth.types'
import { LoginDto } from './dto/login.dto'
import { RefreshTokenDto } from './dto/refresh-token.dto'
import { RegisterDto } from './dto/register.dto'
import { JwtAuthGuard } from './guards/jwt-auth.guard'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Create a new account' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto)
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto)
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate access and refresh tokens' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken)
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke refresh token' })
  async logout(@Body() dto: RefreshTokenDto) {
    await this.auth.logout(dto.refreshToken)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get authenticated user profile' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.getProfile(user.id)
  }
}
