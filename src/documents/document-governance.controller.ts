import { ResourceAccessGuard } from '../security/resource-access.guard'
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { DocumentGovernanceService } from './document-governance.service'

@UseGuards(JwtAuthGuard, ResourceAccessGuard)
@Controller('document-instances/:id/governance')
export class DocumentGovernanceController {
  constructor(private readonly service: DocumentGovernanceService) {}

  @Get()
  dossier(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.dossier(id, user)
  }

  @Post('revisions')
  newRevision(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.service.createRevision(id, body, user)
  }

  @Post('publish')
  publish(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.service.publish(id, body, user)
  }
}
