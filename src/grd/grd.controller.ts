import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { GrdService } from './grd.service'

@UseGuards(JwtAuthGuard)
@Controller('document-instances/:id/grd')
export class GrdController {
  constructor(private readonly service: GrdService) {}
  @Get()
  get(@CurrentUser() user: any, @Param('id') id: string) { return this.service.get(user, id) }
  @Get('candidates')
  candidates(@CurrentUser() user: any, @Param('id') id: string, @Query('search') search = '') { return this.service.candidates(user, id, search) }
  @Post('existing')
  addExisting(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) { return this.service.addExisting(user, id, String(body?.documentInstanceId ?? '')) }
  @Post('new')
  addNew(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) { return this.service.addNew(user, id, body) }
  @Delete(':relationId')
  remove(@CurrentUser() user: any, @Param('id') id: string, @Param('relationId') relationId: string) { return this.service.remove(user, id, relationId) }
}
