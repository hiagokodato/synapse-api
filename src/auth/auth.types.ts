import type { Role } from '@prisma/client'
import type { Request } from 'express'

export type AuthUser = {
  id: string
  email: string
  name: string
  role: Role
}

export type AuthenticatedRequest = Request & {
  user: AuthUser
}

export type TokenPair = {
  accessToken: string
  refreshToken: string
}

export type AuthResponse = TokenPair & {
  user: AuthUser
}
