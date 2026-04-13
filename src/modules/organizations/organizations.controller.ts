import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query } from '@nestjs/common'
import { OrganizationsService } from './organizations.service'
import { CreateAreaDto, CreateRoleDto, CreateGroupDto } from './dto/organization.dto'
import { CurrentUser, type JwtUser } from '../../common/auth.decorator'

function normalize(doc: any) {
  if (!doc) return doc
  const obj = doc._doc ?? doc
  return { ...obj, id: String(obj._id ?? obj.id), _id: undefined }
}

@Controller()
export class OrganizationsController {
  constructor(private readonly svc: OrganizationsService) {}

  // ── Unidades ───────────────────────────────────────────────────────────────
  @Get(['organizationUnits', 'organization/units'])
  getUnits(@CurrentUser() user: JwtUser) {
    return this.svc.findAllUnits(user.accountId)
  }

  @Post(['organizationUnits', 'organization/units'])
  createUnit(@Body() dto: CreateAreaDto, @CurrentUser() user: JwtUser) {
    return this.svc.createUnit({ ...dto, accountId: user.accountId })
  }

  @Put(['organizationUnits/:id', 'organization/units/:id'])
  updateUnit(@Param('id') id: string, @Body() dto: Partial<CreateAreaDto>) {
    return this.svc.updateUnit(id, dto)
  }

  @Patch(['organizationUnits/:id', 'organization/units/:id'])
  patchUnit(@Param('id') id: string, @Body() dto: Partial<CreateAreaDto>) {
    return this.svc.updateUnit(id, dto)
  }

  @Delete(['organizationUnits/:id', 'organization/units/:id'])
  removeUnit(@Param('id') id: string) {
    return this.svc.removeUnit(id)
  }

  // ── Áreas ──────────────────────────────────────────────────────────────────
  @Get(['organizationAreas', 'organization/areas'])
  getAreas(@CurrentUser() user: JwtUser) {
    return this.svc.findAllAreas(user.accountId)
  }

  @Post(['organizationAreas', 'organization/areas'])
  createArea(@Body() dto: CreateAreaDto, @CurrentUser() user: JwtUser) {
    return this.svc.createArea({ ...dto, accountId: user.accountId })
  }

  @Put(['organizationAreas/:id', 'organization/areas/:id'])
  updateArea(@Param('id') id: string, @Body() dto: Partial<CreateAreaDto>) {
    return this.svc.updateArea(id, dto)
  }

  @Patch(['organizationAreas/:id', 'organization/areas/:id'])
  patchArea(@Param('id') id: string, @Body() dto: Partial<CreateAreaDto>) {
    return this.svc.updateArea(id, dto)
  }

  @Delete(['organizationAreas/:id', 'organization/areas/:id'])
  removeArea(@Param('id') id: string) {
    return this.svc.removeArea(id)
  }

  // ── Funções ────────────────────────────────────────────────────────────────
  @Get(['organizationRoles', 'organization/roles'])
  getRoles(@CurrentUser() user: JwtUser) {
    return this.svc.findAllRoles(user.accountId)
  }

  @Post(['organizationRoles', 'organization/roles'])
  createRole(@Body() dto: CreateRoleDto, @CurrentUser() user: JwtUser) {
    return this.svc.createRole({ ...dto, accountId: user.accountId })
  }

  @Put(['organizationRoles/:id', 'organization/roles/:id'])
  updateRole(@Param('id') id: string, @Body() dto: Partial<CreateRoleDto>) {
    return this.svc.updateRole(id, dto)
  }

  @Patch(['organizationRoles/:id', 'organization/roles/:id'])
  patchRole(@Param('id') id: string, @Body() dto: Partial<CreateRoleDto>) {
    return this.svc.updateRole(id, dto)
  }

  @Delete(['organizationRoles/:id', 'organization/roles/:id'])
  removeRole(@Param('id') id: string) {
    return this.svc.removeRole(id)
  }

  // ── Disciplinas ────────────────────────────────────────────────────────────
  @Get(['organizationDisciplines', 'organization/disciplines'])
  getDisciplines(@CurrentUser() user: JwtUser) {
    return this.svc.findAllDisciplines(user.accountId)
  }

  @Post(['organizationDisciplines', 'organization/disciplines'])
  createDiscipline(@Body() dto: CreateAreaDto, @CurrentUser() user: JwtUser) {
    return this.svc.createDiscipline({ ...dto, accountId: user.accountId })
  }

  @Put(['organizationDisciplines/:id', 'organization/disciplines/:id'])
  updateDiscipline(@Param('id') id: string, @Body() dto: Partial<CreateAreaDto>) {
    return this.svc.updateDiscipline(id, dto)
  }

  @Patch(['organizationDisciplines/:id', 'organization/disciplines/:id'])
  patchDiscipline(@Param('id') id: string, @Body() dto: Partial<CreateAreaDto>) {
    return this.svc.updateDiscipline(id, dto)
  }

  @Delete(['organizationDisciplines/:id', 'organization/disciplines/:id'])
  removeDiscipline(@Param('id') id: string) {
    return this.svc.removeDiscipline(id)
  }

  // ── Grupos ─────────────────────────────────────────────────────────────────
  @Get(['organizationGroups', 'organization/groups'])
  getGroups(@CurrentUser() user: JwtUser) {
    return this.svc.findAllGroups(user.accountId)
  }

  @Post(['organizationGroups', 'organization/groups'])
  createGroup(@Body() dto: CreateGroupDto, @CurrentUser() user: JwtUser) {
    return this.svc.createGroup({ ...dto, accountId: user.accountId })
  }

  @Put(['organizationGroups/:id', 'organization/groups/:id'])
  updateGroup(@Param('id') id: string, @Body() dto: Partial<CreateGroupDto>) {
    return this.svc.updateGroup(id, dto)
  }

  @Patch(['organizationGroups/:id', 'organization/groups/:id'])
  patchGroup(@Param('id') id: string, @Body() dto: Partial<CreateGroupDto>) {
    return this.svc.updateGroup(id, dto)
  }

  @Delete(['organizationGroups/:id', 'organization/groups/:id'])
  removeGroup(@Param('id') id: string) {
    return this.svc.removeGroup(id)
  }
}