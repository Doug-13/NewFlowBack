import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { WorkflowEventService } from './workflow-event.service'

@UseGuards(JwtAuthGuard)
@Controller('workflow-events')
export class WorkflowEventController {
  constructor(private readonly events: WorkflowEventService) {}
  @Post('publish') publish(@CurrentUser() user: any, @Body() body: unknown) { return this.events.publish(user,body) }
  @Get() list(@CurrentUser() user: any) { return this.events.list(user) }
}
