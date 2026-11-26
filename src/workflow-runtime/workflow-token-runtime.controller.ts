import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { WorkflowTokenRuntimeService } from './workflow-token-runtime.service'

@UseGuards(JwtAuthGuard)
@Controller('workflow-tokens/documents/:id')
export class WorkflowTokenRuntimeController {
  constructor(private readonly runtime: WorkflowTokenRuntimeService) {}

  @Get()
  list(@CurrentUser() user: any, @Param('id') id: string) {
    return this.runtime.list(user, id)
  }

  @Post('start')
  start(@CurrentUser() user: any, @Param('id') id: string) {
    return this.runtime.start(user, id)
  }

  @Post(':tokenId/actions')
  action(@CurrentUser() user: any, @Param('id') id: string, @Param('tokenId') tokenId: string, @Body() body: any) {
    return this.runtime.action(user, id, tokenId, body)
  }
}
