import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { enforceWorkflowAssignee } from '../workflow-runtime/assignment-access'

type Action = 'read' | 'write' | 'execute' | 'admin'

@Injectable()
export class ResourceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(user: any) { return String(user?.role ?? '').toLowerCase() === 'admin' }
  private account(user: any): string {
    const id = String(user?.accountId ?? '')
    if (!id || !user?.id) throw new ForbiddenException('Conta ou usuário não identificado.')
    return id
  }
  private values(value: any, key: string): string[] {
    const list = value && typeof value === 'object' && !Array.isArray(value) ? value[key] : undefined
    return Array.isArray(list) ? list.filter((v: any) => typeof v === 'string') : []
  }
  private async memberIds(user: any) {
    const [memberships, groups] = await Promise.all([
      this.prisma.user_process_memberships.findMany({ where: { account_id: this.account(user), user_id: user.id, is_active: true }, select: { process_id: true } }),
      this.prisma.organization_groups.findMany({ where: { account_id: this.account(user), is_active: true }, select: { id: true, member_ids: true } }),
    ])
    return { memberships: new Set(memberships.map(x => x.process_id)), groupIds: new Set(groups.filter(g => Array.isArray(g.member_ids) && (g.member_ids as string[]).includes(user.id)).map(g => g.id)) }
  }
  async availableProcessIds(user: any, action: 'read' | 'create' = 'read'): Promise<string[]> {
    const accountId = this.account(user)
    const [processes, links, environments] = await Promise.all([
      this.prisma.processes.findMany({ where: { account_id: accountId, is_active: true, status: 'active' } }),
      this.prisma.configuration_environment_processes.findMany({ where: { account_id: accountId }, select: { process_id: true, environment_id: true } }),
      this.prisma.configuration_environments.findMany({ where: { account_id: accountId, is_active: true }, select: { id: true } }),
    ])
    const envIds = new Set(environments.map(e => e.id))
    const publishedIds = new Set(links.filter(l => envIds.has(l.environment_id)).map(l => l.process_id))
    if (this.isAdmin(user)) return processes.filter(p => publishedIds.has(p.id)).map(p => p.id)
    const { memberships, groupIds } = await this.memberIds(user)
    return processes.filter(p => {
      if (!publishedIds.has(p.id)) return false
      const base = p.permissions
      const baseAllowed = memberships.has(p.id) || this.values(base, 'userIds').includes(user.id) || this.values(base, 'groupIds').some(g => groupIds.has(g))
      if (!baseAllowed) return false
      const specific = action === 'create' ? p.document_creation : p.document_visualization
      const users = this.values(specific, 'userIds')
      const groups = this.values(specific, 'groupIds')
      return (!users.length && !groups.length) || users.includes(user.id) || groups.some(g => groupIds.has(g))
    }).map(p => p.id)
  }
  async process(user: any, id: string, action: 'read' | 'create' = 'read') {
    const record = await this.prisma.processes.findFirst({ where: { id, account_id: this.account(user) } })
    if (!record) throw new NotFoundException('Processo não encontrado.')
    if (!this.isAdmin(user) && !(await this.availableProcessIds(user, action)).includes(id)) throw new ForbiddenException('Sem permissão para este processo.')
    return record
  }
  async document(user: any, id: string, action: Action = 'read') {
    const accountId = this.account(user)
    let document = await this.prisma.document_instances.findFirst({ where: { id, account_id: accountId } })
    if (!document) {
      const base = await this.prisma.documents.findFirst({ where: { id, account_id: accountId } })
      if (base?.current_instance_id) document = await this.prisma.document_instances.findFirst({ where: { id: base.current_instance_id, account_id: accountId } })
    }
    if (!document) throw new NotFoundException('Documento não encontrado.')
    if (this.isAdmin(user)) return document
    await this.process(user, document.process_id, 'read')
    if (action === 'admin') throw new ForbiddenException('Ação reservada ao administrador.')
    if (action === 'execute') {
      await enforceWorkflowAssignee(this.prisma, user, document)
    } else if (action === 'write') {
      if (document.created_by_id !== user.id && document.current_assigned_user_id !== user.id) throw new ForbiddenException('Usuário não autorizado a alterar este documento.')
    }
    return document
  }
  async workflow(user: any, id: string, mutation = false) {
    this.account(user)
    if (mutation && !this.isAdmin(user)) throw new ForbiddenException('Edição de workflows restrita ao administrador.')
    const record = await this.prisma.workflows.findFirst({ where: { id, account_id: user.accountId } })
    if (!record) throw new NotFoundException('Workflow não encontrado.')
    if (!this.isAdmin(user)) {
      if (!record.process_id) throw new ForbiddenException('Workflow não disponibilizado para o usuário.')
      await this.process(user, record.process_id)
    }
    return record
  }
  assertAdmin(user: any) {
    this.account(user)
    if (!this.isAdmin(user)) throw new ForbiddenException('Ação restrita ao administrador.')
  }
}
