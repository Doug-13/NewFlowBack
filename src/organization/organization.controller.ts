import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { OrganizationService } from './organization.service'

@UseGuards(JwtAuthGuard)
@Controller('organization')
export class OrganizationController {
  constructor(private readonly service: OrganizationService) {}

  @Get('units')
  units() { return this.service.units() }

  @Get('units/:id')
  unit(@Param('id') id: string) { return this.service.unit(id) }

  @Post('units')
  createUnit(@Body() body: any, @CurrentUser() user: any) {
    return this.service.createUnit({ ...body, accountId: body.accountId || user.accountId })
  }

  @Put('units/:id')
  updateUnit(@Param('id') id: string, @Body() body: any) {
    return this.service.updateUnit(id, body)
  }

  @Delete('units/:id')
  deleteUnit(@Param('id') id: string) { return this.service.deleteUnit(id) }

  @Get('areas')
  areas(@Query('unitId') unitId?: string) { return this.service.areas(unitId) }

  @Get('areas/:id')
  area(@Param('id') id: string) { return this.service.area(id) }

  @Post('areas')
  createArea(@Body() body: any, @CurrentUser() user: any) {
    return this.service.createArea({ ...body, accountId: body.accountId || user.accountId })
  }

  @Put('areas/:id')
  updateArea(@Param('id') id: string, @Body() body: any) {
    return this.service.updateArea(id, body)
  }

  @Delete('areas/:id')
  deleteArea(@Param('id') id: string) { return this.service.deleteArea(id) }

  @Get('disciplines')
  disciplines(@Query('areaId') areaId?: string) { return this.service.disciplines(areaId) }

  @Get('disciplines/:id')
  discipline(@Param('id') id: string) { return this.service.discipline(id) }

  @Post('disciplines')
  createDiscipline(@Body() body: any, @CurrentUser() user: any) {
    return this.service.createDiscipline({ ...body, accountId: body.accountId || user.accountId })
  }

  @Put('disciplines/:id')
  updateDiscipline(@Param('id') id: string, @Body() body: any) {
    return this.service.updateDiscipline(id, body)
  }

  @Delete('disciplines/:id')
  deleteDiscipline(@Param('id') id: string) { return this.service.deleteDiscipline(id) }

  @Get('roles')
  roles(@Query('disciplineId') disciplineId?: string) { return this.service.roles(disciplineId) }

  @Get('roles/:id')
  role(@Param('id') id: string) { return this.service.role(id) }

  @Post('roles')
  createRole(@Body() body: any, @CurrentUser() user: any) {
    return this.service.createRole({ ...body, accountId: body.accountId || user.accountId })
  }

  @Put('roles/:id')
  updateRole(@Param('id') id: string, @Body() body: any) {
    return this.service.updateRole(id, body)
  }

  @Delete('roles/:id')
  deleteRole(@Param('id') id: string) { return this.service.deleteRole(id) }

  @Get('groups')
  groups() { return this.service.groups() }

  @Post('groups')
  createGroup(@Body() body: any, @CurrentUser() user: any) {
    return this.service.createGroup({ ...body, accountId: body.accountId || user.accountId })
  }

  @Put('groups/:id')
  updateGroup(@Param('id') id: string, @Body() body: any) {
    return this.service.updateGroup(id, body)
  }

  @Delete('groups/:id')
  deleteGroup(@Param('id') id: string) { return this.service.deleteGroup(id) }
}
