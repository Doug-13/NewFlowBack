import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  private areaDto(item: any) {
    return {
      id: item.id,
      accountId: item.account_id,
      name: item.name,
      code: item.code,
      description: item.description,
      type: item.type,
      unitId: item.unit_id,
      areaId: item.unit_id,
      isActive: item.is_active,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }
  }

  private roleDto(item: any) {
    return {
      id: item.id,
      accountId: item.account_id,
      name: item.name,
      code: item.code,
      description: item.description,
      type: item.type,
      isActive: item.is_active,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }
  }

  async units() {
    const items = await this.prisma.organization_areas.findMany({
      where: { type: 'unit' },
      orderBy: { name: 'asc' },
    })
    return items.map((item) => this.areaDto(item))
  }

  async unit(id: string) {
    return this.areaDto(
      await this.prisma.organization_areas.findUniqueOrThrow({ where: { id } }),
    )
  }

  async createUnit(data: any) {
    return this.areaDto(
      await this.prisma.organization_areas.create({
        data: {
          account_id: data.accountId,
          name: data.name,
          code: data.code,
          description: data.description,
          type: 'unit',
          is_active: data.isActive ?? true,
        },
      }),
    )
  }

  async updateUnit(id: string, data: any) {
    return this.areaDto(
      await this.prisma.organization_areas.update({
        where: { id },
        data: {
          name: data.name,
          code: data.code,
          description: data.description,
          is_active: data.isActive,
          updated_at: new Date(),
        },
      }),
    )
  }

  deleteUnit(id: string) {
    return this.prisma.organization_areas.delete({ where: { id } })
  }

  async areas(unitId?: string) {
    const items = await this.prisma.organization_areas.findMany({
      where: {
        type: 'area',
        ...(unitId ? { unit_id: unitId } : {}),
      },
      orderBy: { name: 'asc' },
    })
    return items.map((item) => this.areaDto(item))
  }

  async area(id: string) {
    return this.areaDto(
      await this.prisma.organization_areas.findUniqueOrThrow({ where: { id } }),
    )
  }

  async createArea(data: any) {
    return this.areaDto(
      await this.prisma.organization_areas.create({
        data: {
          account_id: data.accountId,
          name: data.name,
          code: data.code,
          description: data.description,
          type: 'area',
          unit_id: data.unitId || null,
          is_active: data.isActive ?? true,
        },
      }),
    )
  }

  async updateArea(id: string, data: any) {
    const payload: any = {
      name: data.name,
      code: data.code,
      description: data.description,
      unit_id: data.unitId,
      is_active: data.isActive,
      updated_at: new Date(),
    }
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key])
    return this.areaDto(
      await this.prisma.organization_areas.update({ where: { id }, data: payload }),
    )
  }

  deleteArea(id: string) {
    return this.prisma.organization_areas.delete({ where: { id } })
  }

  async disciplines(areaId?: string) {
    const items = await this.prisma.organization_areas.findMany({
      where: {
        type: 'discipline',
        ...(areaId ? { unit_id: areaId } : {}),
      },
      orderBy: { name: 'asc' },
    })
    return items.map((item) => this.areaDto(item))
  }

  async discipline(id: string) {
    return this.areaDto(
      await this.prisma.organization_areas.findUniqueOrThrow({ where: { id } }),
    )
  }

  async createDiscipline(data: any) {
    return this.areaDto(
      await this.prisma.organization_areas.create({
        data: {
          account_id: data.accountId,
          name: data.name,
          code: data.code,
          description: data.description,
          type: 'discipline',
          unit_id: data.areaId || null,
          is_active: data.isActive ?? true,
        },
      }),
    )
  }

  async updateDiscipline(id: string, data: any) {
    const payload: any = {
      name: data.name,
      code: data.code,
      description: data.description,
      unit_id: data.areaId,
      is_active: data.isActive,
      updated_at: new Date(),
    }
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key])
    return this.areaDto(
      await this.prisma.organization_areas.update({ where: { id }, data: payload }),
    )
  }

  deleteDiscipline(id: string) {
    return this.prisma.organization_areas.delete({ where: { id } })
  }

  async roles(_disciplineId?: string) {
    const items = await this.prisma.organization_roles.findMany({
      orderBy: { name: 'asc' },
    })
    return items.map((item) => this.roleDto(item))
  }

  async role(id: string) {
    return this.roleDto(
      await this.prisma.organization_roles.findUniqueOrThrow({ where: { id } }),
    )
  }

  async createRole(data: any) {
    return this.roleDto(
      await this.prisma.organization_roles.create({
        data: {
          account_id: data.accountId,
          name: data.name,
          code: data.code,
          description: data.description,
          type: data.type || 'role',
          is_active: data.isActive ?? true,
        },
      }),
    )
  }

  async updateRole(id: string, data: any) {
    const payload: any = {
      name: data.name,
      code: data.code,
      description: data.description,
      type: data.type,
      is_active: data.isActive,
      updated_at: new Date(),
    }
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key])
    return this.roleDto(
      await this.prisma.organization_roles.update({ where: { id }, data: payload }),
    )
  }

  deleteRole(id: string) {
    return this.prisma.organization_roles.delete({ where: { id } })
  }

  async groups() {
    const groups = await this.prisma.organization_groups.findMany({
      orderBy: { name: 'asc' },
    })
    return groups.map((group) => ({
      id: group.id,
      accountId: group.account_id,
      name: group.name,
      code: group.code,
      description: group.description,
      memberIds: Array.isArray(group.member_ids) ? group.member_ids : [],
      memberNames: Array.isArray(group.member_names) ? group.member_names : [],
      isActive: group.is_active,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
    }))
  }

  async createGroup(data: any) {
    const memberIds = Array.isArray(data.memberIds) ? data.memberIds : []
    const users = memberIds.length
      ? await this.prisma.users.findMany({
          where: { id: { in: memberIds } },
          select: { id: true, name: true },
        })
      : []

    const group = await this.prisma.organization_groups.create({
      data: {
        account_id: data.accountId,
        name: data.name,
        code: data.code,
        description: data.description,
        member_ids: memberIds,
        member_names: users.map((user) => user.name),
        is_active: data.isActive ?? true,
      },
    })

    return {
      ...group,
      accountId: group.account_id,
      memberIds: group.member_ids,
      memberNames: group.member_names,
      isActive: group.is_active,
    }
  }

  async updateGroup(id: string, data: any) {
    const memberIds = Array.isArray(data.memberIds) ? data.memberIds : undefined
    let memberNames: string[] | undefined

    if (memberIds) {
      const users = await this.prisma.users.findMany({
        where: { id: { in: memberIds } },
        select: { name: true },
      })
      memberNames = users.map((user) => user.name)
    }

    const payload: any = {
      name: data.name,
      code: data.code,
      description: data.description,
      member_ids: memberIds,
      member_names: memberNames,
      is_active: data.isActive,
      updated_at: new Date(),
    }
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key])

    const group = await this.prisma.organization_groups.update({
      where: { id },
      data: payload,
    })

    return {
      ...group,
      accountId: group.account_id,
      memberIds: group.member_ids,
      memberNames: group.member_names,
      isActive: group.is_active,
    }
  }

  deleteGroup(id: string) {
    return this.prisma.organization_groups.delete({ where: { id } })
  }
}
