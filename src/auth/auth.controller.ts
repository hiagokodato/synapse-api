import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'

import { CurrentUser } from '../common/decorators/current-user.decorator'
import { parseOrigins } from '../config/configuration'
import { AuthService } from './auth.service'
import type { AuthUser, TokenPair } from './auth.types'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './refresh-cookie'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean
  private readonly allowedOrigins: string[]

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {
    this.isProduction = this.config.get<string>('nodeEnv') === 'production'
    this.allowedOrigins = parseOrigins(this.config.get<string>('corsOrigin'))
  }

  @Post('register')
  @ApiOperation({ summary: 'Create a new account (refresh token is set as an httpOnly cookie)' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const { refreshToken, ...session } = await this.auth.register(dto)
    this.setCookie(response, refreshToken)
    return session
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const { refreshToken, ...session } = await this.auth.login(dto)
    this.setCookie(response, refreshToken)
    return session
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate tokens using the refresh cookie' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Pick<TokenPair, 'accessToken'>> {
    this.assertTrustedOrigin(request)

    const current = readRefreshCookie(request)
    if (!current) {
      throw new UnauthorizedException('Refresh token missing.')
    }

    try {
      const { refreshToken, accessToken } = await this.auth.refresh(current)
      this.setCookie(response, refreshToken)
      return { accessToken }
    } catch (error) {
      clearRefreshCookie(response, this.isProduction)
      throw error
    }
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke the refresh cookie' })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.assertTrustedOrigin(request)

    const current = readRefreshCookie(request)
    if (current) {
      await this.auth.logout(current)
    }
    clearRefreshCookie(response, this.isProduction)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get authenticated user profile' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.getProfile(user.id)
  }

  private setCookie(response: Response, refreshToken: string) {
    setRefreshCookie(response, refreshToken, this.auth.getRefreshTtlMs(), this.isProduction)
  }

  /** Rotas que usam o cookie só aceitam chamadas vindas do front (proteção contra CSRF). */
  private assertTrustedOrigin(request: Request) {
    const origin = request.headers.origin
    if (origin && !this.allowedOrigins.includes(origin)) {
      throw new ForbiddenException('Origin not allowed.')
    }
  }
}
