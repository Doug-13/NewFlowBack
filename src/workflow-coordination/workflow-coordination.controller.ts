import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { WorkflowCoordinationService } from './workflow-coordination.service'

@UseGuards(JwtAuthGuard)
@Controller('workflow-operations')
export class WorkflowCoordinationController {
  constructor(private readonly service: WorkflowCoordinationService) {}

  @Get('documents/:id/links')
  links(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.links(user, id)
  }

  @Post('documents/:id/links')
  linkExisting(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.service.linkExisting(user, id, body)
  }

  @Post('documents/:id/children')
  startChild(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.service.startChild(user, id, body)
  }

  @Post('documents/:id/synchronize')
  synchronize(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.synchronize(user, id)
  }

  @Get('deadlines')
  deadlines(@CurrentUser() user: any) {
    return this.service.deadlines(user)
  }
}
