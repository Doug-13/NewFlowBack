import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ProcessesService } from './processes.service'

@UseGuards(JwtAuthGuard)
@Controller('processes')
export class ProcessesController {
  constructor(private readonly service: ProcessesService) {}

  @Get()
  list(@Query('accountId') accountId: string, @CurrentUser() user: any) {
    return this.service.list(accountId || user.accountId)
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post()
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.service.create(body, user.accountId)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }
}
