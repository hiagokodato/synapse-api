import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface'

import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)

  const port = config.get<number>('port', 3000)
  const nodeEnv = config.get<string>('nodeEnv', 'development')
  const corsOrigin = config.get<string>('corsOrigin', 'http://localhost:5173')
  const allowedOrigins = corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean)

  const isOriginAllowed = (origin: string) =>
    allowedOrigins.includes(origin) || /\.vercel\.app$/i.test(origin)

  app.setGlobalPrefix('v1')

  if (nodeEnv === 'production') {
    app.enableCors({ origin: true, credentials: true })
    Logger.log('CORS: reflecting all origins (production)', 'Bootstrap')
  } else {
    app.enableCors({
      origin: ((origin, callback) => {
        if (!origin || isOriginAllowed(origin)) {
          callback(null, origin ?? true)
          return
        }

        Logger.warn(`Blocked CORS origin: ${origin}`, 'CORS')
        callback(null, false)
      }) satisfies CorsOptions['origin'],
      credentials: true,
    })
    Logger.log(`CORS allowed origins: ${allowedOrigins.join(', ')} + *.vercel.app`, 'Bootstrap')
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Synapse API')
    .setDescription('Backend for the Synapse conversational platform')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build()

  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('docs', app, document)

  await app.listen(port)
  Logger.log(`Synapse API listening on http://localhost:${port}/v1`, 'Bootstrap')
  Logger.log(`Swagger docs at http://localhost:${port}/docs`, 'Bootstrap')
}

bootstrap()
