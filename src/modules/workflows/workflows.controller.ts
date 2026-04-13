import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { WorkflowsService } from './workflows.service'
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto/workflow.dto'
import { CurrentUser, type JwtUser } from '../../common/auth.decorator'

function normalize(wf: any) {
  if (!wf) return wf

  const obj = wf._doc ?? wf

  return {
    ...obj,
    id: String(obj.id ?? obj._id),
    _id: undefined,
  }
}

@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Get()
  async findAll(@CurrentUser() user: JwtUser, @Query() q: any) {
    if (q.processId) {
      const wf = await this.workflowsService.findByProcess(
        q.processId,
        user.accountId,
      )
      return wf ? [normalize(wf)] : []
    }

    const list = await this.workflowsService.findAll(user.accountId)
    return list.map(normalize)
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return normalize(await this.workflowsService.findOne(id, user.accountId))
  }

  @Post()
  async create(@Body() dto: CreateWorkflowDto, @CurrentUser() user: JwtUser) {
    return normalize(await this.workflowsService.create(dto, user.accountId))
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
    @CurrentUser() user: JwtUser,
  ) {
    return normalize(await this.workflowsService.update(id, dto, user.accountId))
  }

  @Patch(':id')
  async patch(
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
    @CurrentUser() user: JwtUser,
  ) {
    return normalize(await this.workflowsService.update(id, dto, user.accountId))
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.workflowsService.remove(id, user.accountId)
  }
}