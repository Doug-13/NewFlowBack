import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { DocumentInstance, DocumentInstanceDocument } from './schema/document.schema'
import { CreateDocumentDto } from './dto/create-document.dto'
import { WorkflowEngineService } from '../workflow/workflow.service'
import { MetadataValue, MetadataValueDocument } from '../metadata/schema/metadata-value.schema'
import { AuditLog, AuditLogDocument } from '../metadata/schema/audit-log.schema'
import { Task, TaskDocument } from '../tasks/schema/task.schema'

@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(DocumentInstance.name)
    private readonly documentModel: Model<DocumentInstanceDocument>,
    @InjectModel(MetadataValue.name)
    private readonly metadataValueModel: Model<MetadataValueDocument>,
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
    private readonly workflowEngine: WorkflowEngineService,
  ) {}

  // ─── Criar ──────────────────────────────────────────────────────────────────

  async create(dto: CreateDocumentDto, creatorId: string, creatorName: string) {
    const count = await this.documentModel.countDocuments({ accountId: dto.accountId })
    const code  = `DOC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`

    const doc = await this.documentModel.create({
      accountId:       dto.accountId,
      processId:       dto.processId,
      processName:     dto.processName ?? '',
      title:           dto.title,
      code,
      revision:        '00',
      status:          'draft',
      workflowId:      dto.workflowId,
      workflowName:    dto.workflowName ?? '',
      createdById:     creatorId,
      createdByName:   creatorName,
      responsibleId:   creatorId,
      responsibleName: creatorName,
    })

    // Salva metadados iniciais
    if (dto.initialMetadataValues) {
      await this.saveInitialMetadata(String(doc._id), dto.accountId, dto.processId, dto.initialMetadataValues)
    }

    // Inicia o workflow
    if (dto.steps?.length) {
      await this.workflowEngine.startDocument(doc, dto.steps, dto.elementConfigs ?? [], creatorId, creatorName)
    }

    return this.findOne(String(doc._id), dto.steps ?? [], dto.elementConfigs ?? [])
  }

  // ─── Listar ─────────────────────────────────────────────────────────────────

  async findAll(filters: { accountId?: string; processId?: string; status?: string; createdById?: string }) {
    const query: Record<string, any> = {}
    if (filters.accountId)   query.accountId   = filters.accountId
    if (filters.processId)   query.processId   = filters.processId
    if (filters.status)      query.status      = filters.status
    if (filters.createdById) query.createdById = filters.createdById

    return this.documentModel.find(query).sort({ createdAt: -1 }).lean()
  }

  // ─── Buscar por ID ───────────────────────────────────────────────────────────

  async findOne(id: string, steps: any[], elementConfigs: any[]) {
    const doc = await this.documentModel.findById(id).lean()
    if (!doc) throw new NotFoundException(`Documento ${id} não encontrado`)
    return this.enrich(doc, steps, elementConfigs)
  }

  // ─── Enriquecer com dados do workflow ────────────────────────────────────────

  async enrich(doc: any, steps: any[], elementConfigs: any[]) {
    const docId = String(doc._id)
    const opSteps = steps.filter((s: any) => !['start','end','gateway','flow'].includes(s.kind ?? ''))
    const curr    = opSteps.find((s: any) => s.orderIndex === doc.currentStepOrderIndex) ?? null

    const [tasks, auditLogs] = await Promise.all([
      this.taskModel.find({ documentInstanceId: new Types.ObjectId(docId) }).sort({ createdAt: -1 }).lean(),
      this.auditLogModel.find({ documentInstanceId: new Types.ObjectId(docId) }).sort({ createdAt: -1 }).lean(),
    ])

    const enrichedTasks = tasks.map((t: any) => {
      let taskActions = t.taskActions ?? []
      if (!taskActions.length) {
        const s = opSteps.find((s: any) => s.orderIndex === t.stepOrderIndex || s.name === t.stepName)
        if (s?.actions?.length) {
          taskActions = s.actions.map((a: any) => ({
            id: a.id ?? a.outcome, label: a.label, color: a.color ?? 'default',
            outcome: a.outcome, requiresComment: Boolean(a.requiresComment),
          }))
        }
      }
      return {
        id: String(t._id), workflowStepId: String(t.stepOrderIndex ?? ''),
        stepName: t.stepName, elementId: t.elementId,
        assignedToUserId: t.assignedUserId, assignedToUserName: t.assignedUserName,
        status: t.status, actionTaken: t.actionTaken ?? null,
        comment: t.comment, dueAt: t.dueDate, completedAt: t.completedAt,
        createdAt: t.createdAt, allowedActions: t.allowedActions ?? [], taskActions,
      }
    })

    return {
      ...doc,
      id:               docId,
      revision:         doc.revision ?? null,
      parentDocumentId: doc.parentDocumentId ? String(doc.parentDocumentId) : null,
      currentStepId:    curr?.id ?? null,
      availableActions: curr?.allowedActions ?? [],
      stepMetadataFields: curr?.metadataFields ?? [],
      tasks:      enrichedTasks,
      auditLogs:  auditLogs.map((l: any) => ({
        id: String(l._id), action: l.action, stepName: l.stepName,
        userName: l.userName, comment: l.comment, createdAt: l.createdAt,
      })),
      workflowSteps: opSteps.map((s: any) => ({
        id: s.id, name: s.name, orderIndex: s.orderIndex,
        isInitial: s.isInitial, isFinal: s.isFinal,
        allowedActions: s.allowedActions, actions: s.actions,
        deadlineMode: s.deadlineMode, deadlineValue: s.deadlineValue,
        responsibles: s.responsibles, transitions: s.transitions,
      })),
    }
  }

  // ─── Cancelar ────────────────────────────────────────────────────────────────

  async cancel(id: string, executorName: string) {
    const doc = await this.documentModel.findById(id)
    if (!doc) throw new NotFoundException(`Documento ${id} não encontrado`)
    await this.documentModel.findByIdAndUpdate(id, {
      status: 'cancelled', currentStepName: null, currentStepOrderIndex: null,
    })
    await this.workflowEngine.addAuditLog(id, 'DocumentoCancelled', { userName: executorName })
    return { success: true }
  }

  // ─── Metadados iniciais ───────────────────────────────────────────────────────

  private async saveInitialMetadata(
    documentId: string,
    accountId: string,
    processId: string,
    values: Record<string, unknown>,
  ) {
    const ops = Object.entries(values)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([defId, value]) => ({
        updateOne: {
          filter: { documentInstanceId: new Types.ObjectId(documentId), metadataDefinitionId: defId },
          update: {
            $set: { documentInstanceId: new Types.ObjectId(documentId), metadataDefinitionId: defId, accountId, processId, value, updatedAt: new Date() },
            $setOnInsert: { createdAt: new Date() },
          },
          upsert: true,
        },
      }))
    if (ops.length) await this.metadataValueModel.bulkWrite(ops)
  }
}
