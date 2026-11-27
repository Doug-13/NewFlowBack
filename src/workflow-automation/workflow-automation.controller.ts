import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ResourceAccessService } from '../security/resource-access.service'
import { WorkflowAutomationService } from './workflow-automation.service'
import { WorkflowAutomationQueueService } from './workflow-automation-queue.service'

@UseGuards(JwtAuthGuard)
@Controller('workflow-automations')
export class WorkflowAutomationController {
  constructor(
    private readonly service: WorkflowAutomationService,
    private readonly queue: WorkflowAutomationQueueService,
    private readonly access: ResourceAccessService,
  ) {}

  @Post('documents/:id/execute')
  execute(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.execute(user, id)
  }

  @Get('jobs')
  jobs(@CurrentUser() user: any) {
    this.access.assertAdmin(user)
    return this.queue.list(user.accountId)
  }

  /** Controlled execution in an authenticated request; no user-supplied scripts or targets. */
  @Post('dispatch')
  async dispatch(@CurrentUser() user: any) {
    this.access.assertAdmin(user)
    const discovered = await this.queue.discover(user.accountId)
    const execution = await this.queue.process(10, user.accountId)
    return { ...discovered, ...execution }
  }
}
