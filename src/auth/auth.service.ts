import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService, JwtSignOptions } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { createHash } from 'node:crypto'

import { PrismaService } from '../prisma/prisma.service'
import type { AuthResponse, AuthUser, TokenPair } from './auth.types'
import type { LoginDto } from './dto/login.dto'
import type { RegisterDto } from './dto/register.dto'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) {
      throw new ConflictException('Email already registered.')
    }

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
      },
      select: { id: true, email: true, name: true, role: true },
    })

    const tokens = await this.issueTokens(user)
    return { ...tokens, user }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (!user) {
      throw new UnauthorizedException('Invalid credentials.')
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials.')
    }

    const safeUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    }

    const tokens = await this.issueTokens(safeUser)
    return { ...tokens, user: safeUser }
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: { sub: string; email: string; role: AuthUser['role'] }

    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      })
    } catch {
      throw new UnauthorizedException('Invalid refresh token.')
    }

    const tokenHash = this.hashToken(refreshToken)
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } })

    if (!stored || stored.expiresAt < new Date() || stored.userId !== payload.sub) {
      throw new UnauthorizedException('Refresh token expired or revoked.')
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true },
    })

    if (!user) {
      throw new UnauthorizedException('User not found.')
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } })
    return this.issueTokens(user)
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken)
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash } })
  }

  async getProfile(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true },
    })

    if (!user) {
      throw new UnauthorizedException('User not found.')
    }

    return user
  }

  private async issueTokens(user: AuthUser): Promise<TokenPair> {
    const payload = { sub: user.id, email: user.email, role: user.role }

    const accessExpiresIn = this.config.get<string>(
      'jwt.accessExpiresIn',
      '15m',
    ) as JwtSignOptions['expiresIn']
    const refreshExpiresIn = this.config.get<string>(
      'jwt.refreshExpiresIn',
      '7d',
    ) as JwtSignOptions['expiresIn']

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: accessExpiresIn,
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn,
      }),
    ])

    await this.storeRefreshToken(user.id, refreshToken)
    return { accessToken, refreshToken }
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken)
    const expiresAt = this.getRefreshExpiryDate()

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    })
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  private getRefreshExpiryDate(): Date {
    const raw = this.config.get<string>('jwt.refreshExpiresIn', '7d')
    const match = /^(\d+)([dhms])$/.exec(raw)

    if (!match) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }

    const value = Number(match[1])
    const unit = match[2]
    const multipliers: Record<string, number> = {
      d: 24 * 60 * 60 * 1000,
      h: 60 * 60 * 1000,
      m: 60 * 1000,
      s: 1000,
    }

    return new Date(Date.now() + value * multipliers[unit])
  }
}
