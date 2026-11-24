import { ResourceAccessService } from '../security/resource-access.service'
import { ResourceAccessGuard } from '../security/resource-access.guard'
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { WorkflowsService } from './workflows.service'

@UseGuards(JwtAuthGuard, ResourceAccessGuard)
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly service: WorkflowsService, private readonly access: ResourceAccessService) {}

  @Get()
  async list(
    @Query('processId') processId: string | undefined,
    @CurrentUser() user: any,
  ) {
    const ids = String(user.role).toLowerCase() === 'admin'
      ? undefined
      : await this.access.availableProcessIds(user)
    return this.service.list(user.accountId, processId, ids)
  }


  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post()
  create(
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.service.create(user.accountId, body)
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }
}
