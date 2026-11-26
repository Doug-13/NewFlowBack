import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  private areaDto(item: any) {
    return { id: item.id, accountId: item.account_id, name: item.name, code: item.code,
      description: item.description, type: item.type, unitId: item.unit_id,
      areaId: item.unit_id, isActive: item.is_active, createdAt: item.created_at, updatedAt: item.updated_at }
  }
  private roleDto(item: any) {
    return { id: item.id, accountId: item.account_id, name: item.name, code: item.code,
      description: item.description, type: item.type, isActive: item.is_active,
      createdAt: item.created_at, updatedAt: item.updated_at }
  }
  private groupDto(group: any) {
    return { id: group.id, accountId: group.account_id, name: group.name, code: group.code,
      description: group.description, memberIds: Array.isArray(group.member_ids) ? group.member_ids : [],
      memberNames: Array.isArray(group.member_names) ? group.member_names : [],
      isActive: group.is_active, createdAt: group.created_at, updatedAt: group.updated_at }
  }
  private checkAccount(accountId: string) {
    if (!accountId || typeof accountId !== 'string') throw new BadRequestException('Conta não identificada.')
  }
  private async areaOf(id: string, accountId: string, type: string) {
    this.checkAccount(accountId)
    const record = await this.prisma.organization_areas.findFirst({ where: { id, account_id: accountId, type } })
    if (!record) throw new NotFoundException('Registro organizacional não encontrado.')
    return record
  }
  private async roleOf(id: string, accountId: string) {
    this.checkAccount(accountId)
    const record = await this.prisma.organization_roles.findFirst({ where: { id, account_id: accountId } })
    if (!record) throw new NotFoundException('Cargo não encontrado.')
    return record
  }
  private async groupOf(id: string, accountId: string) {
    this.checkAccount(accountId)
    const record = await this.prisma.organization_groups.findFirst({ where: { id, account_id: accountId } })
    if (!record) throw new NotFoundException('Grupo não encontrado.')
    return record
  }
  private async assertParent(id: string | undefined, accountId: string, type: string) {
    if (id) await this.areaOf(id, accountId, type)
  }
  private async memberNames(memberIds: string[], accountId: string) {
    if (!memberIds.length) return []
    const unique = [...new Set(memberIds)]
    const users = await this.prisma.users.findMany({
      where: { account_id: accountId, id: { in: unique } }, select: { id: true, name: true },
    })
    if (users.length !== unique.length) throw new BadRequestException('Grupo contém usuário inexistente ou de outra conta.')
    return users.map(user => user.name)
  }
  async units(accountId: string) {
    this.checkAccount(accountId)
    return (await this.prisma.organization_areas.findMany({ where: { account_id: accountId, type: 'unit' }, orderBy: { name: 'asc' } })).map(item => this.areaDto(item))
  }
  async unit(id: string, accountId: string) { return this.areaDto(await this.areaOf(id, accountId, 'unit')) }
  async createUnit(data: any) {
    this.checkAccount(data.accountId)
    return this.areaDto(await this.prisma.organization_areas.create({ data: {
      account_id: data.accountId, name: data.name, code: data.code, description: data.description,
      type: 'unit', is_active: data.isActive ?? true,
    } }))
  }
  async updateUnit(id: string, data: any, accountId: string) {
    await this.areaOf(id, accountId, 'unit')
    return this.areaDto(await this.prisma.organization_areas.update({ where: { id }, data: {
      name: data.name, code: data.code, description: data.description,
      is_active: data.isActive, updated_at: new Date(),
    } }))
  }
  async deleteUnit(id: string, accountId: string) {
    await this.areaOf(id, accountId, 'unit')
    return this.prisma.organization_areas.delete({ where: { id } })
  }
  async areas(accountId: string, unitId?: string) {
    this.checkAccount(accountId)
    if (unitId) await this.areaOf(unitId, accountId, 'unit')
    return (await this.prisma.organization_areas.findMany({ where: {
      account_id: accountId, type: 'area', ...(unitId ? { unit_id: unitId } : {}),
    }, orderBy: { name: 'asc' } })).map(item => this.areaDto(item))
  }
  async area(id: string, accountId: string) { return this.areaDto(await this.areaOf(id, accountId, 'area')) }
  async createArea(data: any) {
    this.checkAccount(data.accountId)
    await this.assertParent(data.unitId, data.accountId, 'unit')
    return this.areaDto(await this.prisma.organization_areas.create({ data: {
      account_id: data.accountId, name: data.name, code: data.code,
      description: data.description, type: 'area', unit_id: data.unitId || null,
      is_active: data.isActive ?? true,
    } }))
  }
  async updateArea(id: string, data: any, accountId: string) {
    await this.areaOf(id, accountId, 'area')
    await this.assertParent(data.unitId, accountId, 'unit')
    return this.areaDto(await this.prisma.organization_areas.update({ where: { id }, data: {
      name: data.name, code: data.code, description: data.description,
      unit_id: data.unitId, is_active: data.isActive, updated_at: new Date(),
    } }))
  }
  async deleteArea(id: string, accountId: string) {
    await this.areaOf(id, accountId, 'area')
    return this.prisma.organization_areas.delete({ where: { id } })
  }
  async disciplines(accountId: string, areaId?: string) {
    this.checkAccount(accountId)
    if (areaId) await this.areaOf(areaId, accountId, 'area')
    return (await this.prisma.organization_areas.findMany({ where: {
      account_id: accountId, type: 'discipline', ...(areaId ? { unit_id: areaId } : {}),
    }, orderBy: { name: 'asc' } })).map(item => this.areaDto(item))
  }
  async discipline(id: string, accountId: string) { return this.areaDto(await this.areaOf(id, accountId, 'discipline')) }
  async createDiscipline(data: any) {
    this.checkAccount(data.accountId)
    await this.assertParent(data.areaId, data.accountId, 'area')
    return this.areaDto(await this.prisma.organization_areas.create({ data: {
      account_id: data.accountId, name: data.name, code: data.code,
      description: data.description, type: 'discipline', unit_id: data.areaId || null,
      is_active: data.isActive ?? true,
    } }))
  }
  async updateDiscipline(id: string, data: any, accountId: string) {
    await this.areaOf(id, accountId, 'discipline')
    await this.assertParent(data.areaId, accountId, 'area')
    return this.areaDto(await this.prisma.organization_areas.update({ where: { id }, data: {
      name: data.name, code: data.code, description: data.description,
      unit_id: data.areaId, is_active: data.isActive, updated_at: new Date(),
    } }))
  }
  async deleteDiscipline(id: string, accountId: string) {
    await this.areaOf(id, accountId, 'discipline')
    return this.prisma.organization_areas.delete({ where: { id } })
  }
  async roles(accountId: string, _disciplineId?: string) {
    this.checkAccount(accountId)
    return (await this.prisma.organization_roles.findMany({ where: { account_id: accountId }, orderBy: { name: 'asc' } })).map(item => this.roleDto(item))
  }
  async role(id: string, accountId: string) { return this.roleDto(await this.roleOf(id, accountId)) }
  async createRole(data: any) {
    this.checkAccount(data.accountId)
    return this.roleDto(await this.prisma.organization_roles.create({ data: {
      account_id: data.accountId, name: data.name, code: data.code,
      description: data.description, type: data.type || 'role', is_active: data.isActive ?? true,
    } }))
  }
  async updateRole(id: string, data: any, accountId: string) {
    await this.roleOf(id, accountId)
    return this.roleDto(await this.prisma.organization_roles.update({ where: { id }, data: {
      name: data.name, code: data.code, description: data.description,
      type: data.type, is_active: data.isActive, updated_at: new Date(),
    } }))
  }
  async deleteRole(id: string, accountId: string) {
    await this.roleOf(id, accountId)
    return this.prisma.organization_roles.delete({ where: { id } })
  }
  async groups(accountId: string) {
    this.checkAccount(accountId)
    return (await this.prisma.organization_groups.findMany({ where: { account_id: accountId }, orderBy: { name: 'asc' } })).map(item => this.groupDto(item))
  }
  async createGroup(data: any) {
    this.checkAccount(data.accountId)
    const memberIds = Array.isArray(data.memberIds) ? data.memberIds : []
    const names = await this.memberNames(memberIds, data.accountId)
    return this.groupDto(await this.prisma.organization_groups.create({ data: {
      account_id: data.accountId, name: data.name, code: data.code,
      description: data.description, member_ids: memberIds, member_names: names,
      is_active: data.isActive ?? true,
    } }))
  }
  async updateGroup(id: string, data: any, accountId: string) {
    await this.groupOf(id, accountId)
    const memberIds: string[] | undefined = Array.isArray(data.memberIds) ? data.memberIds : undefined
    const memberNames = memberIds === undefined ? undefined : await this.memberNames(memberIds, accountId)
    return this.groupDto(await this.prisma.organization_groups.update({ where: { id }, data: {
      name: data.name, code: data.code, description: data.description,
      member_ids: memberIds, member_names: memberNames,
      is_active: data.isActive, updated_at: new Date(),
    } }))
  }
  async deleteGroup(id: string, accountId: string) {
    await this.groupOf(id, accountId)
    return this.prisma.organization_groups.delete({ where: { id } })
  }
}
