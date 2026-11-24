import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

/** Regras documentais inspiradas no portal DGT, persistidas nas tabelas existentes. */
@Injectable()
export class DocumentGovernanceService {
  constructor(private readonly prisma: PrismaService) {}

  private async findOwned(id: string, user: any) {
    const document = await this.prisma.document_instances.findFirst({
      where: { id, account_id: user.accountId },
    })
    if (!document) throw new NotFoundException('Documento não encontrado.')
    return document
  }

  async dossier(id: string, user: any) {
    const current = await this.findOwned(id, user)
    const [base, revisions, audit] = await Promise.all([
      this.prisma.documents.findFirst({ where: { id: current.document_id, account_id: user.accountId } }),
      this.prisma.document_instances.findMany({
        where: { document_id: current.document_id, account_id: user.accountId },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.audit_logs.findMany({
        where: { document_instances: { document_id: current.document_id, account_id: user.accountId } },
        orderBy: { created_at: 'desc' },
        take: 200,
      }),
    ])
    const today = new Date()
    const published = revisions.filter((revision) => revision.status === 'published')
    const active = revisions.find((revision) => revision.id === base?.current_instance_id) ?? null
    return {
      documentId: current.document_id,
      currentInstanceId: base?.current_instance_id ?? null,
      code: current.code,
      title: current.title,
      revisionCount: revisions.length,
      publishedCount: published.length,
      revisions: revisions.map((revision) => ({
        id: revision.id,
        revision: revision.revision,
        title: revision.title,
        status: revision.status,
        isCurrent: revision.id === base?.current_instance_id,
        createdAt: revision.created_at,
        updatedAt: revision.updated_at,
        dueDate: revision.due_date,
        reviewOverdue: Boolean(revision.due_date && revision.due_date < today && revision.status === 'published'),
        createdByName: revision.created_by_name,
      })),
      activeRevision: active?.revision ?? null,
      audit: audit.map((entry) => ({
        id: entry.id,
        revisionInstanceId: entry.document_instance_id,
        action: entry.action,
        userName: entry.user_name,
        comment: entry.comment,
        createdAt: entry.created_at,
      })),
    }
  }

  async createRevision(id: string, body: any, user: any) {
    const source = await this.findOwned(id, user)
    const revision = String(body?.revision ?? '').trim()
    if (!/^(?:Rev\.)?\d{2,4}[A-Z]?$/.test(revision)) {
      throw new BadRequestException('Informe revisão válida, como 01, Rev.01 ou Rev.01A.')
    }
    if (!['published', 'completed', 'archived'].includes(source.status)) {
      throw new ConflictException('Uma nova revisão deve partir de uma revisão encerrada.')
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const base = await tx.documents.findFirst({
        where: { id: source.document_id, account_id: user.accountId },
      })
      if (!base) throw new NotFoundException('Documento base não encontrado.')
      if (base.current_instance_id !== source.id) {
        throw new ConflictException('Crie uma revisão a partir da versão atual do documento.')
      }
      const exists = await tx.document_instances.findFirst({
        where: { document_id: base.id, revision },
      })
      if (exists) throw new ConflictException('Este número de revisão já existe.')
      const firstElement = await tx.workflow_elements.findFirst({
        where: {
          workflow_id: source.workflow_id,
          OR: [{ is_start: true }, { element_kind: 'startEvent' }],
        },
        orderBy: { order_index: 'asc' },
      })
      const next = await tx.document_instances.create({
        data: {
          account_id: source.account_id,
          process_id: source.process_id,
          process_name: source.process_name,
          document_id: source.document_id,
          title: source.title,
          code: source.code,
          revision,
          status: 'draft',
          workflow_id: source.workflow_id,
          workflow_name: source.workflow_name,
          current_element_id: firstElement?.element_id ?? null,
          current_step_name: firstElement?.name ?? null,
          current_step_order_index: firstElement?.order_index ?? null,
          created_by_id: user.id,
          created_by_name: user.name,
          parent_document_id: source.id,
        },
      })
      const values = await tx.metadata_values.findMany({ where: { document_instance_id: source.id } })
      for (const value of values) {
        await tx.metadata_values.create({
          data: {
            account_id: source.account_id,
            process_id: source.process_id,
            document_instance_id: next.id,
            metadata_definition_id: value.metadata_definition_id,
            value: value.value ?? {},
          },
        })
      }
      // A revisão em preparação passa a ser a atual para evitar alterações no histórico.
      await tx.documents.update({
        where: { id: base.id },
        data: { current_instance_id: next.id, updated_at: new Date() },
      })
      await tx.audit_logs.create({
        data: {
          document_instance_id: next.id,
          action: 'revision.created',
          user_name: user.name,
          comment: String(body?.reason ?? 'Nova revisão documental').slice(0, 2000),
          metadata: { previousInstanceId: source.id, revision },
        },
      })
      return next
    })
    return { id: created.id, revision: created.revision, status: created.status }
  }

  async publish(id: string, body: any, user: any) {
    const doc = await this.findOwned(id, user)
    const admin = ['admin', 'administrator', 'administrador'].includes(String(user.role ?? '').toLowerCase())
    if (!admin) throw new ForbiddenException('Publicação restrita ao administrador até a validação de aprovadores por etapa.')
    if (doc.status !== 'completed') {
      throw new ConflictException('A publicação exige fluxo concluído e aprovado.')
    }
    const date = new Date()
    const months = Number(body?.reviewIntervalMonths ?? 12)
    if (!Number.isInteger(months) || months < 1 || months > 120) {
      throw new BadRequestException('O intervalo de revisão deve ter entre 1 e 120 meses.')
    }
    const dueDate = new Date(date)
    dueDate.setUTCMonth(dueDate.getUTCMonth() + months)
    return this.prisma.$transaction(async (tx) => {
      const base = await tx.documents.findFirst({ where: { id: doc.document_id, account_id: user.accountId } })
      if (!base || base.current_instance_id !== id) throw new ConflictException('Somente a revisão atual pode ser publicada.')
      const active = await tx.document_instances.updateMany({
        where: { id, account_id: user.accountId, status: 'completed' },
        data: { status: 'published', due_date: dueDate, updated_at: date },
      })
      if (active.count !== 1) throw new ConflictException('O status do documento mudou. Atualize a página.')
      await tx.audit_logs.create({
        data: {
          document_instance_id: id,
          action: 'revision.published',
          user_name: user.name,
          comment: String(body?.comment ?? '').slice(0, 2000),
          metadata: { dueDate: dueDate.toISOString(), reviewIntervalMonths: months },
        },
      })
      return { id, status: 'published', dueDate: dueDate.toISOString() }
    })
  }
}
