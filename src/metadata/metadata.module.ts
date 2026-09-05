// src/metadata/metadata.module.ts
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { MetadataController } from './metadata.controller'
import { MetadataService } from './metadata.service'

@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],
  controllers: [MetadataController],
  providers: [MetadataService],
})
export class MetadataModule {}