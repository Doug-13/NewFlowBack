import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class ProcessesService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(item: any) {
    return {
      id: item.id,
      accountId: item.account_id,
      name: item.name,
      code: item.code,
      description: item.description,
      workflowId: item.workflow_id,
      parentProcessId: item.parent_process_id,
      status: item.status,
      isActive: item.is_active,
      permissions: item.permissions,
      documentCreation: item.document_creation,
      documentVisualization: item.document_visualization,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }
  }

  private admin(user: any) {
    if (String(user?.role ?? '').toLowerCase() !== 'admin') {
      throw new ForbiddenException('Acesso exclusivo de administradores.')
    }
  }

  private account(user: any): string {
    const accountId = String(user?.accountId ?? '')
    if (!accountId) throw new ForbiddenException('Conta não identificada.')
    return accountId
  }

  private ids(json: any, key: string): string[] {
    const raw = json && typeof json === 'object' && !Array.isArray(json) ? json[key] : undefined
    return Array.isArray(raw) ? raw.map(String) : []
  }

  private async permittedIds(user: any): Promise<Set<string>> {
    const accountId = this.account(user)
    const memberships = await this.prisma.user_process_memberships.findMany({
      where: { account_id: accountId, user_id: user.id, is_active: true },
      select: { process_id: true },
    })
    return new Set(memberships.map((m) => m.process_id))
  }

  private async availableRecords(user: any) {
    const accountId = this.account(user)
    const items = await this.prisma.processes.findMany({
      where: { account_id: accountId, is_active: true, status: 'active' },
      orderBy: { name: 'asc' },
    })
    const links = await this.prisma.configuration_environment_processes.findMany({
      where: { account_id: accountId },
      select: { process_id: true, environment_id: true },
    })
    const environments = await this.prisma.configuration_environments.findMany({
      where: { account_id: accountId, is_active: true }, select: { id: true },
    })
    const enabledEnvironments = new Set(environments.map((e) => e.id))
    const publishedIds = new Set(links.filter((l) => enabledEnvironments.has(l.environment_id)).map((l) => l.process_id))
    const attached = items.filter((p) => publishedIds.has(p.id))
    if (String(user?.role ?? '').toLowerCase() === 'admin') return attached

    const assigned = await this.permittedIds(user)
    const groups = await this.prisma.organization_groups.findMany({
      where: { account_id: accountId, is_active: true },
      select: { id: true, member_ids: true },
    })
    const groupIds = new Set(groups.filter((g) => Array.isArray(g.member_ids) && g.member_ids.includes(user.id)).map((g) => g.id))

    return attached.filter((p) => {
      const userIds = this.ids(p.permissions, 'userIds')
      const allowedGroupIds = this.ids(p.permissions, 'groupIds')
      return assigned.has(p.id) || userIds.includes(user.id) || allowedGroupIds.some((id) => groupIds.has(id))
    })
  }

  async available(user: any) {
    return (await this.availableRecords(user)).map((item) => this.toDto(item))
  }

  async list(user: any) {
    if (String(user?.role ?? '').toLowerCase() !== 'admin') return this.available(user)
    const items = await this.prisma.processes.findMany({
      where: { account_id: this.account(user) }, orderBy: { name: 'asc' },
    })
    return items.map((item) => this.toDto(item))
  }

  async get(id: string, user: any) {
    const item = await this.prisma.processes.findFirst({
      where: { id, account_id: this.account(user) },
    })
    if (!item) throw new NotFoundException('Processo não encontrado.')
    if (String(user?.role ?? '').toLowerCase() !== 'admin') {
      const allowed = await this.availableRecords(user)
      if (!allowed.some((p) => p.id === id)) throw new ForbiddenException('Sem permissão para visualizar este processo.')
    }
    return this.toDto(item)
  }

  async create(data: any, user: any) {
    this.admin(user)
    const item = await this.prisma.processes.create({
      data: {
        account_id: this.account(user),
        name: data.name,
        code: data.code,
        description: data.description,
        workflow_id: data.workflowId || null,
        parent_process_id: data.parentProcessId || null,
        status: data.status || 'active',
        is_active: data.isActive ?? true,
        permissions: data.permissions ?? { userIds: [], groupIds: [] },
        document_creation: data.documentCreation ?? { userIds: [], groupIds: [] },
        document_visualization: data.documentVisualization ?? { userIds: [], groupIds: [] },
      },
    })
    return this.toDto(item)
  }

  async update(id: string, data: any, user: any) {
    this.admin(user)
    await this.get(id, user)
    const payload: any = {
      name: data.name,
      code: data.code,
      description: data.description,
      workflow_id: data.workflowId,
      parent_process_id: data.parentProcessId,
      status: data.status,
      is_active: data.isActive,
      permissions: data.permissions,
      document_creation: data.documentCreation,
      document_visualization: data.documentVisualization,
      updated_at: new Date(),
    }
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key])
    return this.toDto(await this.prisma.processes.update({ where: { id }, data: payload }))
  }

  async remove(id: string, user: any) {
    this.admin(user)
    await this.get(id, user)
    await this.prisma.processes.delete({ where: { id } })
    return { success: true }
  }
}
