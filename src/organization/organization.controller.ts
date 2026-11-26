import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { OrganizationService } from './organization.service'
import { assertAdministrator } from '../security/admin-access'

@UseGuards(JwtAuthGuard)
@Controller('organization')
export class OrganizationController {
  constructor(private readonly service: OrganizationService) {}

  @Get('units') units(@CurrentUser() user: any) { return this.service.units(user.accountId) }
  @Get('units/:id') unit(@Param('id') id: string, @CurrentUser() user: any) { return this.service.unit(id, user.accountId) }
  @Post('units') createUnit(@Body() body: any, @CurrentUser() user: any) {
    assertAdministrator(user)
    return this.service.createUnit({ ...body, accountId: user.accountId })
  }
  @Put('units/:id') updateUnit(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    assertAdministrator(user)
    return this.service.updateUnit(id, body, user.accountId)
  }
  @Delete('units/:id') deleteUnit(@Param('id') id: string, @CurrentUser() user: any) {
    assertAdministrator(user)
    return this.service.deleteUnit(id, user.accountId)
  }

  @Get('areas') areas(@CurrentUser() user: any, @Query('unitId') unitId?: string) { return this.service.areas(user.accountId, unitId) }
  @Get('areas/:id') area(@Param('id') id: string, @CurrentUser() user: any) { return this.service.area(id, user.accountId) }
  @Post('areas') createArea(@Body() body: any, @CurrentUser() user: any) {
    assertAdministrator(user)
    return this.service.createArea({ ...body, accountId: user.accountId })
  }
  @Put('areas/:id') updateArea(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    assertAdministrator(user)
    return this.service.updateArea(id, body, user.accountId)
  }
  @Delete('areas/:id') deleteArea(@Param('id') id: string, @CurrentUser() user: any) {
    assertAdministrator(user)
    return this.service.deleteArea(id, user.accountId)
  }

  @Get('disciplines') disciplines(@CurrentUser() user: any, @Query('areaId') areaId?: string) { return this.service.disciplines(user.accountId, areaId) }
  @Get('disciplines/:id') discipline(@Param('id') id: string, @CurrentUser() user: any) { return this.service.discipline(id, user.accountId) }
  @Post('disciplines') createDiscipline(@Body() body: any, @CurrentUser() user: any) {
    assertAdministrator(user)
    return this.service.createDiscipline({ ...body, accountId: user.accountId })
  }
  @Put('disciplines/:id') updateDiscipline(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    assertAdministrator(user)
    return this.service.updateDiscipline(id, body, user.accountId)
  }
  @Delete('disciplines/:id') deleteDiscipline(@Param('id') id: string, @CurrentUser() user: any) {
    assertAdministrator(user)
    return this.service.deleteDiscipline(id, user.accountId)
  }

  @Get('roles') roles(@CurrentUser() user: any, @Query('disciplineId') disciplineId?: string) { return this.service.roles(user.accountId, disciplineId) }
  @Get('roles/:id') role(@Param('id') id: string, @CurrentUser() user: any) { return this.service.role(id, user.accountId) }
  @Post('roles') createRole(@Body() body: any, @CurrentUser() user: any) {
    assertAdministrator(user)
    return this.service.createRole({ ...body, accountId: user.accountId })
  }
  @Put('roles/:id') updateRole(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    assertAdministrator(user)
    return this.service.updateRole(id, body, user.accountId)
  }
  @Delete('roles/:id') deleteRole(@Param('id') id: string, @CurrentUser() user: any) {
    assertAdministrator(user)
    return this.service.deleteRole(id, user.accountId)
  }

  @Get('groups') groups(@CurrentUser() user: any) { return this.service.groups(user.accountId) }
  @Post('groups') createGroup(@Body() body: any, @CurrentUser() user: any) {
    assertAdministrator(user)
    return this.service.createGroup({ ...body, accountId: user.accountId })
  }
  @Put('groups/:id') updateGroup(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    assertAdministrator(user)
    return this.service.updateGroup(id, body, user.accountId)
  }
  @Delete('groups/:id') deleteGroup(@Param('id') id: string, @CurrentUser() user: any) {
    assertAdministrator(user)
    return this.service.deleteGroup(id, user.accountId)
  }
}
