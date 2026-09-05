import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)

  app.setGlobalPrefix('api')

  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN')?.split(',').map((item) => item.trim()) ?? true,
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
