import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ProcessesService } from './processes.service'

@UseGuards(JwtAuthGuard)
@Controller('processes')
export class ProcessesController {
  constructor(private readonly service: ProcessesService) {}

  @Get('available')
  available(@CurrentUser() user: any) {
    return this.service.available(user)
  }

  @Get()
  list(@CurrentUser() user: any) {
    return this.service.list(user)
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.get(id, user)
  }

  @Post()
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.service.create(body, user)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.service.update(id, body, user)
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user)
  }
}
