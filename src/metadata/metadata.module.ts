import { ResourceAccessService } from '../security/resource-access.service'
import { ResourceAccessGuard } from '../security/resource-access.guard'
import { MetadataSetsController } from './metadata-sets.controller'
import { NotificationTemplatesController } from './notification-templates.controller'
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
  controllers: [MetadataController, MetadataSetsController, NotificationTemplatesController],
  providers: [ResourceAccessService, ResourceAccessGuard,MetadataService],
})
export class MetadataModule {}