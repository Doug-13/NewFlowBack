import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ResourceAccessService } from '../security/resource-access.service'
import { DocumentsService } from '../documents/documents.service'

type GrdRules = { allowExistingDocuments: boolean; allowNewDocuments: boolean; requireDocuments: boolean; minimumDocuments: number }
export function normalizeGrdRules(raw: any): GrdRules {
  const rules = {
    allowExistingDocuments: raw?.allowExistingDocuments !== false,
    allowNewDocuments: raw?.allowNewDocuments !== false,
    requireDocuments: raw?.requireDocuments !== false,
    minimumDocuments: Number(raw?.minimumDocuments ?? 1),
  }
  if (!rules.allowExistingDocuments && !rules.allowNewDocuments) throw new BadRequestException('A GRD não permite adicionar documentos.')
  if (!Number.isInteger(rules.minimumDocuments) || rules.minimumDocuments < 1 || rules.minimumDocuments > 1000) throw new BadRequestException('Quantidade mínima da GRD inválida.')
  return rules
}
export function grdReady(count: number, rules: GrdRules): boolean {
  return !rules.requireDocuments || count >= rules.minimumDocuments
}

@Injectable()
export class GrdService {
  constructor(private readonly prisma: PrismaService, private readonly access: ResourceAccessService, private readonly documents: DocumentsService) {}

  private async context(user: any, grdId: string, write = false) {
    const parent = await this.access.document(user, grdId, write ? 'write' : 'read')
    const links = await this.prisma.configuration_environment_processes.findMany({
      where: { account_id: user.accountId, process_id: parent.process_id }, select: { environment_id: true },
    })
    const code = `PROC_${parent.process_id.replace(/-/g, '').toUpperCase()}`
    const resources = await this.prisma.configuration_resources.findMany({
      where: { account_id: user.accountId, kind: 'process-settings', code, is_active: true,
        environment_id: { in: links.map(x => x.environment_id) } }, select: { content: true },
    })
    if (resources.length !== 1) throw new BadRequestException('O processo requer uma configuração ativa única.')
    const settings = resources[0].content as any
    if (settings?.documentBehavior?.type !== 'grd') throw new BadRequestException('Este documento não pertence a um processo GRD.')
    if (write && ['published', 'completed', 'archived', 'cancelled'].includes(parent.status)) throw new ConflictException('Não é permitido alterar uma GRD encerrada.')
    return { parent, rules: normalizeGrdRules(settings?.documentBehavior?.grd) }
  }

  private async relations(user: any, parent: any) {
    const rows = await this.prisma.document_relations.findMany({
      where: { account_id: user.accountId, parent_document_instance_id: parent.id, relation_type: 'grd' },
      orderBy: { created_at: 'asc' },
    })
    const allowed = await this.access.availableProcessIds(user)
    const children = await this.prisma.document_instances.findMany({
      where: { account_id: user.accountId, id: { in: rows.map(r => r.child_document_instance_id) }, process_id: { in: allowed } },
      select: { id: true, document_id: true, title: true, code: true, revision: true, status: true, process_id: true },
    })
    const map = new Map(children.map(c => [c.id, c]))
    return rows.filter(r => map.has(r.child_document_instance_id)).map(r => ({
      id: r.id, linkedAt: r.created_at, document: map.get(r.child_document_instance_id),
    }))
  }

  async get(user: any, grdId: string) {
    const { parent, rules } = await this.context(user, grdId)
    const documents = await this.relations(user, parent)
    return { processId: parent.process_id, rules, count: documents.length, ready: grdReady(documents.length, rules), documents,
      editable: !['published', 'completed', 'archived', 'cancelled'].includes(parent.status) }
  }

  async candidates(user: any, grdId: string, search: string) {
    const { parent, rules } = await this.context(user, grdId)
    if (!rules.allowExistingDocuments) return []
    const ids = await this.access.availableProcessIds(user)
    if (!ids.length) return []
    const items = await this.prisma.document_instances.findMany({
      where: { account_id: user.accountId, process_id: { in: ids }, id: { not: parent.id },
        ...(search.trim() ? { OR: [{ code: { contains: search.trim(), mode: 'insensitive' as const } }, { title: { contains: search.trim(), mode: 'insensitive' as const } }] } : {}) },
      orderBy: { created_at: 'desc' }, take: 80,
      select: { id: true, document_id: true, code: true, title: true, revision: true, process_id: true, status: true },
    })
    const linked = await this.prisma.document_relations.findMany({ where: { account_id: user.accountId, parent_document_instance_id: parent.id, relation_type: 'grd' }, select: { child_document_id: true } })
    const linkedIds = new Set(linked.map(x => x.child_document_id))
    return items.filter(x => x.document_id !== parent.document_id && !linkedIds.has(x.document_id))
  }

  private async link(user: any, parent: any, child: any) {
    if (parent.document_id === child.document_id) throw new BadRequestException('A GRD não pode vincular a si mesma.')
    const prior = await this.prisma.document_relations.findFirst({
      where: { account_id: user.accountId, parent_document_instance_id: parent.id, relation_type: 'grd', child_document_id: child.document_id },
    })
    if (prior) throw new ConflictException('Este documento já está vinculado à GRD.')
    const relation = await this.prisma.document_relations.create({ data: {
      account_id: user.accountId,
      parent_document_id: parent.document_id,
      parent_document_instance_id: parent.id,
      child_document_id: child.document_id,
      child_document_instance_id: child.id,
      relation_type: 'grd',
      parent_process_id: parent.process_id,
      child_process_id: child.process_id,
      child_workflow_id: child.workflow_id,
      created_by_id: user.id,
      created_by_name: user.name ?? null,
    } })
    return { id: relation.id }
  }

  async addExisting(user: any, grdId: string, childId: string) {
    const { parent, rules } = await this.context(user, grdId, true)
    if (!rules.allowExistingDocuments) throw new ForbiddenException('Vínculo de documentos existentes desativado nesta GRD.')
    if (!childId) throw new BadRequestException('Informe o documento para vinculação.')
    const child = await this.access.document(user, childId, 'read')
    return this.link(user, parent, child)
  }

  async addNew(user: any, grdId: string, data: any) {
    const { parent, rules } = await this.context(user, grdId, true)
    if (!rules.allowNewDocuments) throw new ForbiddenException('Criação de documentos pela GRD desativada.')
    const processId = String(data?.processId ?? '')
    const workflowId = String(data?.workflowId ?? '')
    const title = String(data?.title ?? '').trim()
    if (!processId || !workflowId || !title || title.length > 255) throw new BadRequestException('Informe título, processo e workflow válidos.')
    const process = await this.access.process(user, processId, 'create')
    const workflow = await this.prisma.workflows.findFirst({ where: { id: workflowId, account_id: user.accountId, process_id: processId } })
    if (!workflow) throw new NotFoundException('Workflow não encontrado para o processo.')
    // A criação é independente: em caso de erro no vínculo, o documento novo permanece para recuperação administrativa.
    const child = await this.documents.create({ processId, processName: process.name, workflowId,
      workflowName: workflow.name, title, initialMetadataValues: {} }, user)
    const full = await this.access.document(user, child.id, 'read')
    try { return { document: { id: child.id, code: child.code, title: child.title }, relation: await this.link(user, parent, full) } }
    catch (e) { throw new ConflictException(`Documento ${child.code} criado, mas não foi possível vinculá-lo. Vincule-o manualmente antes de continuar.`) }
  }

  async remove(user: any, grdId: string, relationId: string) {
    const { parent } = await this.context(user, grdId, true)
    const rel = await this.prisma.document_relations.findFirst({ where: { id: relationId, account_id: user.accountId, parent_document_instance_id: parent.id, relation_type: 'grd' } })
    if (!rel) throw new NotFoundException('Vínculo não encontrado.')
    await this.prisma.document_relations.delete({ where: { id: rel.id } })
    return { success: true }
  }
}
