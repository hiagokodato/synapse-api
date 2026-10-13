import type { CookieOptions, Request, Response } from 'express'

/**
 * O refresh token vive só neste cookie httpOnly: o JavaScript do navegador não consegue lê-lo,
 * então um XSS no front não rouba a sessão de 7 dias.
 */
export const REFRESH_COOKIE = 'synapse_rt'

function cookieOptions(isProduction: boolean, maxAgeMs?: number): CookieOptions {
  return {
    httpOnly: true,
    // Em produção front (Vercel) e API (Railway) estão em sites diferentes: precisa de SameSite=None + Secure.
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/v1/auth',
    ...(maxAgeMs !== undefined ? { maxAge: maxAgeMs } : {}),
  }
}

export function setRefreshCookie(
  response: Response,
  token: string,
  maxAgeMs: number,
  isProduction: boolean,
) {
  response.cookie(REFRESH_COOKIE, token, cookieOptions(isProduction, maxAgeMs))
}

export function clearRefreshCookie(response: Response, isProduction: boolean) {
  response.clearCookie(REFRESH_COOKIE, cookieOptions(isProduction))
}

/** Lê o cookie direto do header (evita depender do cookie-parser). */
export function readRefreshCookie(request: Request): string | undefined {
  const header = request.headers.cookie
  if (!header) return undefined

  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === REFRESH_COOKIE) {
      return decodeURIComponent(rest.join('='))
    }
  }
  return undefined
}
