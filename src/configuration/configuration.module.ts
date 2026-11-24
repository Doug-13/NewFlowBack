import { AuthModule } from '../auth/auth.module'
import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { ConfigurationController } from './configuration.controller'
import { ConfigurationService } from './configuration.service'

@Module({ imports: [AuthModule, PrismaModule], controllers: [ConfigurationController], providers: [ConfigurationService] })
export class ConfigurationModule {}
