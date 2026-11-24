import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { DocumentsController } from './documents.controller'
import { DocumentsService } from './documents.service'
import { DocumentGovernanceService } from './document-governance.service'
import { DocumentGovernanceController } from './document-governance.controller'

@Module({
  imports: [AuthModule],
  controllers: [DocumentsController, DocumentGovernanceController],
  providers: [DocumentsService, DocumentGovernanceService],
})
export class DocumentsModule {}
