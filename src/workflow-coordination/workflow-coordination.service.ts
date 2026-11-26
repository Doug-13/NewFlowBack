import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ResourceAccessService } from '../security/resource-access.service'
import { DocumentsService } from '../documents/documents.service'

const finished = new Set(['completed', 'published', 'archived'])
const closed = new Set(['completed', 'published', 'archived', 'cancelled'])

export function deadlineState(date: Date | string | null, now = new Date()) {
  if (!date) return { overdue: false, daysRemaining: null }
  const millis = new Date(date).getTime() - now.getTime()
  if (!Number.isFinite(millis)) return { overdue: false, daysRemaining: null }
  return { overdue: millis < 0, daysRemaining: Math.ceil(millis / 86400000) }
}

@Injectable()
export class WorkflowCoordinationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ResourceAccessService,
    private readonly documents: DocumentsService,
  ) {}

  private async parent(user: any, id: string, writable = false) {
    const record = await this.access.document(user, id, writable ? 'write' : 'read')
    if (writable && closed.has(record.status)) throw new ConflictException('Processo de origem encerrado.')
    return record
  }

  private async visibleLinks(user: any, parent: any) {
    const relations = await this.prisma.document_relations.findMany({
      where: { account_id: user.accountId, parent_document_instance_id: parent.id, relation_type: 'subprocess' },
      orderBy: { created_at: 'asc' },
    })
    const visible: any[] = []
    for (const relation of relations) {
      try {
        const child = await this.access.document(user, relation.child_document_instance_id, 'read')
        visible.push({ relationId: relation.id, documentInstanceId: child.id, title: child.title,
          code: child.code, status: child.status, processId: child.process_id,
          waitForCompletion: relation.wait_for_completion, relationStatus: relation.status,
          completedAt: relation.child_completed_at })
      } catch (error) {
        // Keep protected child documents hidden, including their identifiers.
        if (error instanceof NotFoundException || (error as any)?.status === 403) continue
        throw error
      }
    }
    return visible
  }

  async links(user: any, parentId: string) {
    const parent = await this.parent(user, parentId)
    const links = await this.visibleLinks(user, parent)
    const waiting = links.filter(link => link.waitForCompletion)
    return { parentDocumentInstanceId: parent.id, links,
      waiting: waiting.length,
      completed: waiting.filter(link => finished.has(link.status)).length,
      readyToContinue: waiting.length > 0 && waiting.every(link => finished.has(link.status)),
    }
  }

  private async createRelation(user: any, parent: any, child: any, waitForCompletion: boolean) {
    if (parent.id === child.id || parent.document_id === child.document_id) {
      throw new BadRequestException('Um documento não pode ser subprocesso de si mesmo.')
    }
    // Reject an existing edge. Cross-process and cross-account access was checked by access.document().
    const exists = await this.prisma.document_relations.findFirst({ where: {
      account_id: user.accountId, parent_document_instance_id: parent.id,
      child_document_instance_id: child.id, relation_type: 'subprocess',
    } })
    if (exists) return { relationId: exists.id, alreadyLinked: true }
    const relation = await this.prisma.document_relations.create({ data: {
      account_id: user.accountId, parent_document_id: parent.document_id,
      parent_document_instance_id: parent.id, child_document_id: child.document_id,
      child_document_instance_id: child.id, relation_type: 'subprocess',
      parent_process_id: parent.process_id, child_process_id: child.process_id,
      child_workflow_id: child.workflow_id, wait_for_completion: waitForCompletion,
      status: finished.has(child.status) ? 'completed' : 'created',
      child_completed_at: finished.has(child.status) ? new Date() : null,
      created_by_id: user.id, created_by_name: user.name ?? null,
    } })
    return { relationId: relation.id, alreadyLinked: false }
  }

  async linkExisting(user: any, parentId: string, body: any) {
    const parent = await this.parent(user, parentId, true)
    const childId = String(body?.childDocumentInstanceId ?? '').trim()
    if (!childId) throw new BadRequestException('Informe childDocumentInstanceId.')
    const child = await this.access.document(user, childId, 'read')
    return this.createRelation(user, parent, child, body?.waitForCompletion === true)
  }

  async startChild(user: any, parentId: string, body: any) {
    const parent = await this.parent(user, parentId, true)
    const processId = String(body?.processId ?? '').trim()
    const workflowId = String(body?.workflowId ?? '').trim()
    const title = String(body?.title ?? '').trim()
    if (!processId || !workflowId || !title || title.length > 255) {
      throw new BadRequestException('Informe processo, workflow e título válidos.')
    }
    const process = await this.access.process(user, processId, 'create')
    const workflow = await this.access.workflow(user, workflowId)
    if (workflow.process_id !== process.id) throw new BadRequestException('Workflow não pertence ao processo informado.')
    // Document creation and relation insertion are separate operations. A failed link is
    // reported with the new document ID for administrator-led recovery, never silently hidden.
    const created = await this.documents.create({ processId, workflowId, processName: process.name,
      workflowName: workflow.name, title }, user)
    const child = await this.access.document(user, created.id, 'read')
    try {
      const relation = await this.createRelation(user, parent, child, body?.waitForCompletion === true)
      return { document: { id: created.id, code: created.code, title: created.title }, ...relation }
    } catch {
      throw new ConflictException(`Documento filho ${created.id} criado, mas não vinculado. Corrija o vínculo antes de continuar.`)
    }
  }

  async synchronize(user: any, parentId: string) {
    const parent = await this.parent(user, parentId, true)
    const rows = await this.prisma.document_relations.findMany({ where: {
      account_id: user.accountId, parent_document_instance_id: parent.id,
      relation_type: 'subprocess', wait_for_completion: true,
    } })
    let updated = 0
    for (const relation of rows) {
      const child = await this.prisma.document_instances.findFirst({ where: {
        id: relation.child_document_instance_id, account_id: user.accountId,
      }, select: { status: true } })
      if (child && finished.has(child.status) && relation.status !== 'completed') {
        const result = await this.prisma.document_relations.updateMany({ where: {
          id: relation.id, account_id: user.accountId, status: { not: 'completed' },
        }, data: { status: 'completed', child_completed_at: new Date(), updated_at: new Date() } })
        updated += result.count
      }
    }
    // Intentionally does NOT move the parent's BPMN token; this requires an atomic resume engine.
    const pending = await this.prisma.document_relations.count({ where: {
      account_id: user.accountId, parent_document_instance_id: parent.id,
      relation_type: 'subprocess', wait_for_completion: true, status: { not: 'completed' },
    } })
    return { updated, waiting: rows.length, pending, readyToContinue: rows.length > 0 && pending === 0,
      parentAdvanced: false }
  }

  async deadlines(user: any) {
    const isAdmin = String(user?.role ?? '').toLowerCase() === 'admin'
    const permitted = isAdmin ? null : await this.access.availableProcessIds(user)
    const documents = await this.prisma.document_instances.findMany({ where: {
      account_id: user.accountId, status: { notIn: [...closed] }, due_date: { not: null },
      ...(permitted ? { process_id: { in: permitted } } : {}),
    }, select: { id: true, title: true, code: true, process_id: true, due_date: true,
      current_assigned_user_id: true, created_by_id: true }, orderBy: { due_date: 'asc' }, take: 200 })
    const allowed = isAdmin ? documents : documents.filter(d =>
      d.current_assigned_user_id === user.id || d.created_by_id === user.id)
    return allowed.map(d => ({ documentInstanceId: d.id, title: d.title, code: d.code,
      processId: d.process_id, dueDate: d.due_date, ...deadlineState(d.due_date) }))
  }
}
