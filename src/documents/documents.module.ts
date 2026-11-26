import { GrdController } from '../grd/grd.controller'
import { GrdService } from '../grd/grd.service'
import { LdImportController } from '../ld-import/ld-import.controller'
import { LdImportService } from '../ld-import/ld-import.service'
import { DocumentNumberingService } from '../document-numbering/document-numbering.service'
import { ResourceAccessService } from '../security/resource-access.service'
import { ResourceAccessGuard } from '../security/resource-access.guard'
import { WorkflowCoordinationController } from '../workflow-coordination/workflow-coordination.controller'
import { WorkflowCoordinationService } from '../workflow-coordination/workflow-coordination.service'
import { WorkflowTokenRuntimeService } from '../workflow-runtime/workflow-token-runtime.service'
import { WorkflowTokenRuntimeController } from '../workflow-runtime/workflow-token-runtime.controller'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { DocumentsController } from './documents.controller'
import { DocumentsService } from './documents.service'
import { DocumentGovernanceService } from './document-governance.service'
import { DocumentGovernanceController } from './document-governance.controller'

@Module({
  imports: [AuthModule],
  controllers: [GrdController,LdImportController,DocumentsController, DocumentGovernanceController, WorkflowCoordinationController, WorkflowTokenRuntimeController],
  providers: [GrdService,LdImportService,DocumentNumberingService,ResourceAccessService, ResourceAccessGuard,DocumentsService, DocumentGovernanceService, WorkflowCoordinationService, WorkflowTokenRuntimeService],
})
export class DocumentsModule {}
