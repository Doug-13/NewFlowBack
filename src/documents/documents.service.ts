import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { randomUUID } from 'crypto'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

type DocumentStatus = string

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(item: any) {
    if (!item) return item
    return {
      id: item.id,
      accountId: item.account_id,
      processId: item.process_id,
      processName: item.process_name,
      title: item.title,
      code: item.code,
      revision: item.revision,
      parentDocumentId: item.parent_document_id,
      status: item.status,
      workflowId: item.workflow_id,
      workflowName: item.workflow_name,
      currentStepName: item.current_step_name,
      currentStepOrderIndex: item.current_step_order_index,
      responsibleId: item.responsible_id,
      responsibleName: item.responsible_name,
      createdById: item.created_by_id,
      createdByName: item.created_by_name,
      dueDate: item.due_date,
      currentElementId: item.current_element_id,
      currentAssignedUserId: item.current_assigned_user_id,
      currentAssignedUserName: item.current_assigned_user_name,
      allowedActions: item.allowed_actions,
      taskActions: item.task_actions,
      documentId: item.document_id,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }
  }

  async list(params: any, currentUser: any) {
    const where: any = {
      account_id: params.accountId || currentUser.accountId,
    }

    if (params.processId) where.process_id = params.processId
    if (params.status) where.status = params.status
    if (params.createdById) where.created_by_id = params.createdById
    if (params.code) where.code = params.code

    const items = await this.prisma.document_instances.findMany({
      where,
      orderBy: { created_at: 'desc' },
    })
    return items.map((item) => this.toDto(item))
  }

  async my(params: any, currentUser: any) {
    const items = await this.prisma.document_instances.findMany({
      where: {
        account_id: params.accountId || currentUser.accountId,
        created_by_id: currentUser.id,
        ...(params.processId ? { process_id: params.processId } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
      orderBy: { created_at: 'desc' },
    })
    return items.map((item) => this.toDto(item))
  }

  async get(id: string) {
    const item = await this.prisma.document_instances.findUnique({
      where: { id },
    })

    if (!item) throw new NotFoundException('Documento não encontrado.')

    const [auditLogs, actions] = await Promise.all([
      this.auditLogs(id),
      this.actionHistory(id),
    ])

    return {
      ...this.toDto(item),
      auditLogs,
      actions,
      files: this.localFiles(id),
    }
  }

  async instances(id: string) {
    const current = await this.prisma.document_instances.findUniqueOrThrow({
      where: { id },
    })
    const items = await this.prisma.document_instances.findMany({
      where: { document_id: current.document_id },
      orderBy: { created_at: 'desc' },
    })
    return items.map((item) => this.toDto(item))
  }

  async create(data: any, currentUser: any) {
    const accountId = data.accountId || currentUser.accountId
    const processId = data.processId
    if (!processId) throw new NotFoundException('Processo não informado.')

    const count = await this.prisma.documents.count({
      where: { account_id: accountId },
    })
    const code = data.code || `DOC-${String(count + 1).padStart(6, '0')}`

    const workflowId = String(data.workflowId || '')
    if (!workflowId) throw new NotFoundException('Workflow não informado.')

    const firstElement = await this.prisma.workflow_elements.findFirst({
      where: {
        workflow_id: workflowId,
        OR: [{ is_start: true }, { element_kind: 'startEvent' }],
      },
      orderBy: { order_index: 'asc' },
    })

    const result = await this.prisma.$transaction(async (tx) => {
      const base = await tx.documents.create({
        data: {
          account_id: accountId,
          process_id: processId,
          process_name: data.processName,
          title: data.title,
          code,
          workflow_id: workflowId,
          workflow_name: data.workflowName,
          created_by_id: data.createdById || currentUser.id,
          created_by_name: data.createdByName || currentUser.name,
        },
      })

      const instance = await tx.document_instances.create({
        data: {
          account_id: accountId,
          process_id: processId,
          process_name: data.processName,
          title: data.title,
          code,
          revision: data.revision || '00',
          status: 'draft',
          workflow_id: workflowId,
          workflow_name: data.workflowName,
          current_step_name: firstElement?.name,
          current_step_order_index: firstElement?.order_index,
          current_element_id: firstElement?.element_id,
          created_by_id: data.createdById || currentUser.id,
          created_by_name: data.createdByName || currentUser.name,
          document_id: base.id,
        },
      })

      await tx.documents.update({
        where: { id: base.id },
        data: { current_instance_id: instance.id },
      })

      if (data.initialMetadataValues && typeof data.initialMetadataValues === 'object') {
        const entries = Object.entries(data.initialMetadataValues)
        for (const [metadataDefinitionId, value] of entries) {
          await tx.metadata_values.upsert({
            where: {
              document_instance_id_metadata_definition_id: {
                document_instance_id: instance.id,
                metadata_definition_id: metadataDefinitionId,
              },
            },
            update: { value: value as any, updated_at: new Date() },
            create: {
              document_instance_id: instance.id,
              metadata_definition_id: metadataDefinitionId,
              account_id: accountId,
              process_id: processId,
              value: value as any,
            },
          })
        }
      }

      return instance
    })

    await this.audit(result.id, currentUser, 'document.created', {
      code: result.code,
      title: result.title,
    })

    return this.get(result.id)
  }

  async update(id: string, data: any, currentUser: any) {
    const current = await this.prisma.document_instances.findUniqueOrThrow({
      where: { id },
    })

    const payload: any = {
      title: data.title,
      process_id: data.processId,
      process_name: data.processName,
      workflow_id: data.workflowId,
      workflow_name: data.workflowName,
      responsible_id: data.responsibleId,
      responsible_name: data.responsibleName,
      due_date: data.dueDate ? new Date(data.dueDate) : undefined,
      updated_at: new Date(),
    }
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key])

    const updated = await this.prisma.$transaction(async (tx) => {
      const instance = await tx.document_instances.update({
        where: { id },
        data: payload,
      })

      const basePayload: any = {
        title: data.title,
        process_id: data.processId,
        process_name: data.processName,
        workflow_id: data.workflowId,
        workflow_name: data.workflowName,
        updated_at: new Date(),
      }
      Object.keys(basePayload).forEach(
        (key) => basePayload[key] === undefined && delete basePayload[key],
      )

      await tx.documents.update({
        where: { id: current.document_id },
        data: basePayload,
      })

      if (data.initialMetadataValues && typeof data.initialMetadataValues === 'object') {
        for (const [metadataDefinitionId, value] of Object.entries(data.initialMetadataValues)) {
          await tx.metadata_values.upsert({
            where: {
              document_instance_id_metadata_definition_id: {
                document_instance_id: id,
                metadata_definition_id: metadataDefinitionId,
              },
            },
            update: { value: value as any, updated_at: new Date() },
            create: {
              document_instance_id: id,
              metadata_definition_id: metadataDefinitionId,
              account_id: current.account_id,
              process_id: current.process_id,
              value: value as any,
            },
          })
        }
      }

      return instance
    })

    await this.audit(id, currentUser, 'document.updated', payload)
    return this.get(updated.id)
  }

  async changeStatus(id: string, status: DocumentStatus, currentUser: any, body: any = {}) {
    const item = await this.prisma.document_instances.update({
      where: { id },
      data: {
        status,
        updated_at: new Date(),
      },
    })

    await this.audit(id, currentUser, `document.${status}`, {
      comment: body.comment,
      executorName: body.executorName || body.userName || currentUser.name,
    })

    return this.toDto(item)
  }

  async executeAction(id: string, body: any, currentUser: any) {
    const document = await this.prisma.document_instances.findUniqueOrThrow({
      where: { id },
    })

    const transition = await this.prisma.workflow_transitions.findFirst({
      where: {
        workflow_id: document.workflow_id,
        source_element_id: document.current_element_id || '',
        OR: [
          ...(body.outcome ? [{ outcome: body.outcome }] : []),
          { is_default: true },
        ],
      },
      orderBy: [{ is_default: 'asc' }, { order_index: 'asc' }],
    })

    const target = transition
      ? await this.prisma.workflow_elements.findFirst({
          where: {
            workflow_id: document.workflow_id,
            element_id: transition.target_element_id,
          },
        })
      : null

    const isEnd = Boolean(target?.is_end || target?.element_kind === 'endEvent')

    await this.prisma.$transaction([
      this.prisma.document_action_history.create({
        data: {
          document_instance_id: id,
          step_name: document.current_step_name,
          step_order_index: document.current_step_order_index,
          element_id: document.current_element_id,
          action_id: String(body.actionId || body.action || 'action'),
          outcome: body.outcome,
          comment: body.comment,
          executed_by_user_id: currentUser.id,
          executed_by_user_name: currentUser.name,
        },
      }),
      this.prisma.document_instances.update({
        where: { id },
        data: {
          current_element_id: target?.element_id ?? document.current_element_id,
          current_step_name: target?.name ?? document.current_step_name,
          current_step_order_index: target?.order_index ?? document.current_step_order_index,
          status: isEnd ? 'completed' : document.status === 'draft' ? 'in_progress' : document.status,
          updated_at: new Date(),
        },
      }),
    ])

    await this.audit(id, currentUser, 'document.action', body)
    return this.get(id)
  }

  async references(id: string) {
    const refs = await this.prisma.document_relations.findMany({
      where: {
        OR: [
          { parent_document_instance_id: id },
          { child_document_instance_id: id },
        ],
      },
      include: {
        document_instances_document_relations_parent_document_instance_idTodocument_instances: true,
        document_instances_document_relations_child_document_instance_idTodocument_instances: true,
      },
      orderBy: { created_at: 'desc' },
    })

    return refs.map((ref: any) => {
      const parent =
        ref.document_instances_document_relations_parent_document_instance_idTodocument_instances
      const child =
        ref.document_instances_document_relations_child_document_instance_idTodocument_instances
      const direction = ref.parent_document_instance_id === id ? 'child' : 'parent'
      const linked = direction === 'child' ? child : parent

      return {
        id: ref.id,
        direction,
        relationGroupId: ref.relation_group_id,
        relationType: ref.relation_type,
        status: ref.status,
        waitForCompletion: ref.wait_for_completion,
        waitPolicy: ref.wait_policy,
        sourceTableMetadataDefinitionId: ref.source_table_metadata_definition_id,
        sourceTableName: ref.source_table_name,
        sourceRowKey: ref.source_row_key,
        sourceRowIndex: ref.source_row_index,
        sourceRowValue: ref.source_row_value,
        parentProcessId: ref.parent_process_id,
        parentProcessName: ref.parent_process_name,
        childProcessId: ref.child_process_id,
        childProcessName: ref.child_process_name,
        childWorkflowId: ref.child_workflow_id,
        childWorkflowName: ref.child_workflow_name,
        parentWaitingElementId: ref.parent_waiting_element_id,
        parentNextElementId: ref.parent_next_element_id,
        documentId: linked?.document_id,
        documentInstanceId: linked?.id,
        code: linked?.code,
        title: linked?.title,
        revision: linked?.revision,
        currentStepName: linked?.current_step_name,
        parentDocumentId: parent?.document_id,
        parentDocumentInstanceId: parent?.id,
        parentCode: parent?.code,
        parentTitle: parent?.title,
        parentStatus: parent?.status,
        childDocumentId: child?.document_id,
        childDocumentInstanceId: child?.id,
        childCode: child?.code,
        childTitle: child?.title,
        childStatus: child?.status,
        createdAt: ref.created_at,
        updatedAt: ref.updated_at,
      }
    })
  }

  files(id: string) {
    return this.localFiles(id)
  }

  async createFile(id: string, file: Express.Multer.File, body: any, currentUser: any) {
    await this.prisma.document_instances.findUniqueOrThrow({ where: { id } })
    const files = this.readFileManifest()
    const saved = {
      id: randomUUID(),
      documentInstanceId: id,
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      attachmentType: body.attachmentType || null,
      description: body.description || null,
      storageProvider: 'local',
      storageKey: file.path.replace(/\\/g, '/'),
      createdAt: new Date().toISOString(),
    }
    files.push(saved)
    this.writeFileManifest(files)

    await this.audit(id, currentUser, 'file.uploaded', {
      fileId: saved.id,
      name: saved.originalName,
    })

    return saved
  }

  async deleteFile(id: string, fileId: string, currentUser: any) {
    const files = this.readFileManifest()
    const file = files.find(
      (item: any) => item.id === fileId && item.documentInstanceId === id,
    )
    if (!file) throw new NotFoundException('Arquivo não encontrado.')

    this.writeFileManifest(files.filter((item: any) => item.id !== fileId))
    await this.audit(id, currentUser, 'file.deleted', {
      fileId,
      name: file.originalName,
    })

    return { success: true, storageKey: file.storageKey }
  }

  async auditLogs(id: string) {
    const items = await this.prisma.audit_logs.findMany({
      where: { document_instance_id: id },
      orderBy: { created_at: 'asc' },
    })
    return items.map((item) => ({
      id: item.id,
      documentInstanceId: item.document_instance_id,
      action: item.action,
      stepName: item.step_name,
      userName: item.user_name,
      comment: item.comment,
      metadata: item.metadata,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }))
  }

  async actionHistory(id: string) {
    const items = await this.prisma.document_action_history.findMany({
      where: { document_instance_id: id },
      orderBy: { executed_at: 'asc' },
    })
    return items.map((item) => ({
      id: item.id,
      documentInstanceId: item.document_instance_id,
      stepName: item.step_name,
      stepOrderIndex: item.step_order_index,
      elementId: item.element_id,
      actionId: item.action_id,
      outcome: item.outcome,
      comment: item.comment,
      executedByUserId: item.executed_by_user_id,
      executedByUserName: item.executed_by_user_name,
      executedAt: item.executed_at,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }))
  }

  async remove(id: string) {
    const current = await this.prisma.document_instances.findUniqueOrThrow({
      where: { id },
    })

    await this.prisma.$transaction(async (tx) => {
      const base = await tx.documents.findUnique({
        where: { id: current.document_id },
        select: { current_instance_id: true },
      })

      if (base?.current_instance_id === id) {
        await tx.documents.update({
          where: { id: current.document_id },
          data: { current_instance_id: null },
        })
      }

      await tx.document_instances.delete({ where: { id } })

      const remaining = await tx.document_instances.count({
        where: { document_id: current.document_id },
      })

      if (remaining === 0) {
        await tx.documents.delete({ where: { id: current.document_id } })
      }
    })

    return { success: true }
  }

  private audit(documentInstanceId: string, user: any, action: string, details?: any) {
    return this.prisma.audit_logs.create({
      data: {
        document_instance_id: documentInstanceId,
        action,
        step_name: details?.stepName,
        user_name: user?.name,
        comment: details?.comment,
        metadata: details ?? {},
      },
    })
  }

  private manifestPath() {
    return join(process.cwd(), 'uploads', '.files.json')
  }

  private readFileManifest(): any[] {
    const path = this.manifestPath()
    if (!existsSync(path)) return []
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8'))
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  private writeFileManifest(files: any[]) {
    writeFileSync(this.manifestPath(), JSON.stringify(files, null, 2), 'utf8')
  }

  private localFiles(documentInstanceId: string) {
    return this.readFileManifest().filter(
      (item: any) => item.documentInstanceId === documentInstanceId,
    )
  }
}
