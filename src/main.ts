import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { resolveCorsOrigins } from './auth/auth-security'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)

  app.setGlobalPrefix('api')

  app.enableCors({
    origin: resolveCorsOrigins(config.get<string>('CORS_ORIGIN'), process.env.NODE_ENV === 'production'),
    credentials: true,
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  )

  const port = Number(config.get('PORT') || 3000)
  await app.listen(port)

  console.log(`NewFlowDev API: http://localhost:${port}/api`)
}

bootstrap()
