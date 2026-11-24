import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ConfigurationService } from './configuration.service'

@UseGuards(JwtAuthGuard)
@Controller('configuration')
export class ConfigurationController {
  constructor(private readonly service: ConfigurationService) {}

  @Get('environments') listEnvironments(@CurrentUser() user: any) { return this.service.listEnvironments(user) }
  @Post('environments') createEnvironment(@CurrentUser() user: any, @Body() body: any) { return this.service.createEnvironment(user, body) }
  @Patch('environments/:id') updateEnvironment(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) { return this.service.updateEnvironment(user, id, body) }

  @Get('environments/:id/processes') listProcesses(@CurrentUser() user: any, @Param('id') id: string) { return this.service.listProcesses(user, id) }
  @Post('environments/:id/processes') attachProcess(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) { return this.service.attachProcess(user, id, body) }
  @Delete('environments/:id/processes/:processId') detachProcess(@CurrentUser() user: any, @Param('id') id: string, @Param('processId') processId: string) { return this.service.detachProcess(user, id, processId) }

  @Get('environments/:id/resources/:kind') listResources(@CurrentUser() user: any, @Param('id') id: string, @Param('kind') kind: string) { return this.service.listResources(user, id, kind) }
  @Post('environments/:id/resources/:kind') createResource(@CurrentUser() user: any, @Param('id') id: string, @Param('kind') kind: string, @Body() body: any) { return this.service.createResource(user, id, kind, body) }
  @Patch('environments/:id/resources/:kind/:resourceId') updateResource(@CurrentUser() user: any, @Param('id') id: string, @Param('kind') kind: string, @Param('resourceId') resourceId: string, @Body() body: any) { return this.service.updateResource(user, id, kind, resourceId, body) }
}
