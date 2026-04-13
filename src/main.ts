import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  )

  const port = Number(process.env.PORT ?? 3000)
  await app.listen(port)
  console.log(`🚀 API rodando em http://localhost:${port}`)
}

bootstrap()
