// src/environment-settings/environment-settings.module.ts
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { EnvironmentSettingsController } from './environment-settings.controller'
import { EnvironmentSettingsService } from './environment-settings.service'

@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],
  controllers: [EnvironmentSettingsController],
  providers: [EnvironmentSettingsService],
})
export class EnvironmentSettingsModule {}