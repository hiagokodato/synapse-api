/** "a.com, b.com" → ['a.com', 'b.com'] (usado no CORS HTTP e no WebSocket). */
export function parseOrigins(value: string | undefined): string[] {
  return (value ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

export default () => {
  const nodeEnv = process.env.NODE_ENV ?? 'development'

  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv,
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    publicUrl: (process.env.PUBLIC_BASE_URL ?? '').replace(/\/+$/, ''),
    // Em produção a documentação só fica no ar se for pedida explicitamente.
    swaggerEnabled: (process.env.SWAGGER_ENABLED ?? (nodeEnv === 'production' ? 'false' : 'true')) === 'true',
    credentialsEncryptionKey: process.env.CREDENTIALS_ENCRYPTION_KEY ?? '',
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET,
      refreshSecret: process.env.JWT_REFRESH_SECRET,
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    },
    throttle: {
      ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
      limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
    },
  }
}
