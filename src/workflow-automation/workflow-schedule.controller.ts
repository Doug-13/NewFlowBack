import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { WorkflowScheduleService } from './workflow-schedule.service'

@UseGuards(JwtAuthGuard)
@Controller('workflow-schedule')
export class WorkflowScheduleController {
  constructor(private readonly schedule: WorkflowScheduleService) {}

  @Get('notifications')
  notifications(@CurrentUser() user: any) {
    return this.schedule.notifications(user)
  }

  @Patch('notifications/:id/read')
  markRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.schedule.markRead(user, id)
  }
}
