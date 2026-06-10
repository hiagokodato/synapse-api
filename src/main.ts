import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)

  const port = config.get<number>('port', 3000)
  const corsOrigin = config.get<string>('corsOrigin', 'http://localhost:5173')

  app.setGlobalPrefix('v1')
  app.enableCors({
    origin: corsOrigin.split(',').map((origin) => origin.trim()),
    credentials: true,
  })

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
