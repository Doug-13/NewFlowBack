import { ResourceAccessService } from '../security/resource-access.service'
import { ResourceAccessGuard } from '../security/resource-access.guard'
// src/workflows/workflows.module.ts
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { WorkflowsController } from './workflows.controller'
import { WorkflowsService } from './workflows.service'

@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],
  controllers: [WorkflowsController],
  providers: [ResourceAccessService, ResourceAccessGuard,WorkflowsService],
})
export class WorkflowsModule {}