import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

import { AppModule } from './app.module'
import { parseOrigins } from './config/configuration'
import { CorsIoAdapter } from './websocket/cors-io.adapter'

async function bootstrap() {
  // rawBody: necessário para validar a assinatura HMAC dos webhooks do WhatsApp.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true })
  const config = app.get(ConfigService)

  const port = config.get<number>('port', 3000)
  const allowedOrigins = parseOrigins(config.get<string>('corsOrigin'))

  app.setGlobalPrefix('v1')
  app.useBodyParser('json', { limit: '200kb' })
  app.enableCors({ origin: allowedOrigins, credentials: true })
  app.useWebSocketAdapter(new CorsIoAdapter(app, allowedOrigins))
  Logger.log(`CORS origins: ${allowedOrigins.join(', ')}`, 'Bootstrap')

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  if (config.get<boolean>('swaggerEnabled')) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Synapse API')
      .setDescription('Backend for the Synapse conversational platform')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build()

    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('docs', app, document)
    Logger.log(`Swagger docs at http://localhost:${port}/docs`, 'Bootstrap')
  }

  await app.listen(port)
  Logger.log(`Synapse API listening on http://localhost:${port}/v1`, 'Bootstrap')
}

bootstrap()
