import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name)

  constructor() {
    const connectionString = process.env.DATABASE_URL

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL não foi definida. Verifique o arquivo .env.',
      )
    }

    const adapter = new PrismaPg({
      connectionString,
    })

    super({
      adapter,
    })
  }

  async onModuleInit() {
    await this.$connect()

    this.logger.log('PostgreSQL/Neon conectado com sucesso')
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}