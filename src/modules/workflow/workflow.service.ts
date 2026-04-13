import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { DocumentInstance, DocumentInstanceDocument } from '../documents/schema/document.schema'
import { Task, TaskDocument } from '../tasks/schema/task.schema'
import { MetadataValue, MetadataValueDocument } from '../metadata/schema/metadata-value.schema'
import { AuditLog, AuditLogDocument } from '../metadata/schema/audit-log.schema'

// ─── Tipos do workflow ────────────────────────────────────────────────────────

export type WorkflowTransition = {
  triggerAction: string
  toStepOrderIndex: number
  intermediateEventIds?: string[]
}

export type WorkflowStep = {
  id: string
  name: string
  orderIndex: number
  isInitial?: boolean
  isFinal?: boolean
  kind?: string
  allowedActions?: string[]
  actions?: Array<{ id: string; label: string; color: string; outcome: string; requiresComment: boolean }>
  responsibles?: Array<{ type: string; id?: string; name: string }>
  transitions?: WorkflowTransition[]
  deadlineMode?: string
  deadlineValue?: number | string
  metadataFields?: Array<{
    metadataDefinitionId: string
    name?: string
    label?: string
    fieldType?: string
    isRequired: boolean
    isReadOnly?: boolean
  }>
}

export type WorkflowElementConfig = {
  elementId: string
  kind: string
  config: Record<string, unknown>
}

export type ExecuteActionContext = {
  taskId: string
  outcome: string
  comment?: string
  executorId: string
  executorName: string
}

@Injectable()
export class WorkflowEngineService {
  constructor(
    @InjectModel(DocumentInstance.name)
    private readonly documentModel: Model<DocumentInstanceDocument>,
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
    @InjectModel(MetadataValue.name)
    private readonly metadataValueModel: Model<MetadataValueDocument>,
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private getOperationalSteps(steps: WorkflowStep[]): WorkflowStep[] {
    return steps.filter((s) => !['start', 'end', 'gateway', 'flow'].includes(s.kind ?? ''))
  }

  private findTransition(step: WorkflowStep, outcome: string): WorkflowTransition | undefined {
    return step.transitions?.find((t) => t.triggerAction === outcome)
  }

  private calculateDueDate(mode?: string, value?: number | string): Date | null {
    if (!mode || value === undefined || value === null) return null
    const v = Number(value)
    if (isNaN(v) || v <= 0) return null
    const d = new Date()
    if (mode === 'hours') { d.setHours(d.getHours() + v); return d }
    if (mode === 'days')  { d.setDate(d.getDate()   + v); return d }
    return null
  }

  private nextRevision(current: string | null, pattern = 'numeric', initial = '00'): string {
    if (!current) return initial
    if (pattern === 'numeric') {
      const n = parseInt(current, 10)
      return isNaN(n) ? initial : String(n + 1).padStart(initial.length || 2, '0')
    }
    if (pattern === 'alphabetic') {
      const u = current.toUpperCase()
      if (u === 'Z') return 'AA'
      if (u.length === 1) return String.fromCharCode(u.charCodeAt(0) + 1)
      const chars = u.split('')
      let i = chars.length - 1
      while (i >= 0) {
        if (chars[i] !== 'Z') { chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1); break }
        chars[i] = 'A'; i--
      }
      if (i < 0) chars.unshift('A')
      return chars.join('')
    }
    return initial
  }

  // ─── Audit log ────────────────────────────────────────────────────────────

  async addAuditLog(
    documentInstanceId: string,
    action: string,
    opts?: { stepName?: string | null; userName?: string | null; comment?: string | null },
  ) {
    await this.auditLogModel.create({
      documentInstanceId: new Types.ObjectId(documentInstanceId),
      action,
      stepName: opts?.stepName ?? null,
      userName: opts?.userName ?? null,
      comment:  opts?.comment  ?? null,
    })
  }

  // ─── Criar tarefa ─────────────────────────────────────────────────────────

  async createTask(doc: DocumentInstanceDocument, step: WorkflowStep, creatorId: string) {
    const taskActions = (step.actions ?? []).map((a) => ({
      id: a.id ?? a.outcome, label: a.label, color: a.color ?? 'default',
      outcome: a.outcome, requiresComment: Boolean(a.requiresComment),
    }))

    let assignedUserId   = creatorId
    let assignedUserName = 'Responsável'

    const resp = step.responsibles?.[0]
    if (resp?.type === 'user' && resp.id) {
      assignedUserId   = resp.id
      assignedUserName = resp.name ?? 'Usuário'
    }

    await this.taskModel.create({
      accountId:          doc.accountId,
      processId:          doc.processId,
      processName:        doc.processName,
      documentInstanceId: doc._id,
      documentTitle:      doc.title,
      documentCode:       doc.code,
      stepName:           step.name,
      stepOrderIndex:     step.orderIndex,
      elementId:          step.id,
      assignedUserId,
      assignedUserName,
      status:             'pending',
      allowedActions:     step.allowedActions ?? [],
      taskActions:        taskActions.length > 0 ? taskActions : [],
      deadlineMode:       step.deadlineMode,
      deadlineValue:      step.deadlineValue,
      dueDate:            this.calculateDueDate(step.deadlineMode, step.deadlineValue),
      completedAt:        null,
      comment:            null,
    })
  }

  // ─── Iniciar documento no workflow ────────────────────────────────────────

  async startDocument(
    doc: DocumentInstanceDocument,
    steps: WorkflowStep[],
    elementConfigs: WorkflowElementConfig[],
    creatorId: string,
    creatorName: string,
  ) {
    const opSteps = this.getOperationalSteps(steps)
    const first   = opSteps[0]
    if (!first) return

    await this.documentModel.findByIdAndUpdate(doc._id, {
      currentStepName:       first.name,
      currentStepOrderIndex: first.orderIndex,
      status:                'in_progress',
    })

    const updated = await this.documentModel.findById(doc._id)
    if (updated) await this.createTask(updated, first, creatorId)

    await this.addAuditLog(String(doc._id), 'DocumentoCreated', {
      stepName: first.name, userName: creatorName,
    })
  }

  // ─── Executar evento intermediário ────────────────────────────────────────
  // Retorna true se o evento tratou completamente o avanço.

  async executeIntermediateEvent(
    doc: DocumentInstanceDocument,
    eventId: string,
    elementConfigs: WorkflowElementConfig[],
    destinationStep: WorkflowStep | null,
    executorName: string,
  ): Promise<boolean> {
    const cfg = elementConfigs.find((c) => c.elementId === eventId)
    if (!cfg) return false

    const kind   = cfg.kind
    const config = cfg.config

    // ── CONDITIONAL: incrementa revisão no doc atual e avança para destino ───
    if (kind === 'conditional') {
      const rev = this.nextRevision(
        doc.revision,
        String(config.revisionPattern      ?? 'numeric'),
        String(config.revisionInitialValue ?? '00'),
      )

      await this.documentModel.findByIdAndUpdate(doc._id, {
        revision:              rev,
        status:                destinationStep ? 'in_progress' : 'draft',
        currentStepName:       destinationStep?.name       ?? null,
        currentStepOrderIndex: destinationStep?.orderIndex ?? null,
        updatedAt:             new Date(),
      })

      if (destinationStep) {
        const updated = await this.documentModel.findById(doc._id)
        if (updated) await this.createTask(updated, destinationStep, String(doc.createdById))
      }

      await this.addAuditLog(String(doc._id), 'RevisionIncremented', {
        stepName: destinationStep?.name ?? null,
        userName: executorName,
        comment: `Rev ${doc.revision ?? '—'} → Rev ${rev}`,
      })

      return true
    }

    if (kind === 'message') {
      await this.addAuditLog(String(doc._id), 'NotificationDispatched', {
        userName: executorName,
        comment: `Templates: [${((config.notificationTemplateIds as string[]) ?? []).join(', ')}]`,
      })
      return false
    }

    if (kind === 'timer') {
      await this.addAuditLog(String(doc._id), 'TimerFired', {
        userName: executorName,
        comment: `Timer: ${String(config.timerType ?? 'fixed-delay')}`,
      })
      return false
    }

    if (kind === 'signal') {
      await this.addAuditLog(String(doc._id), 'SignalDispatched', {
        userName: executorName,
        comment: `Processo destino: ${String(config.targetProcessId ?? '')}`,
      })
      return false
    }

    return false
  }

  // ─── Avançar documento ────────────────────────────────────────────────────

  async advanceDocument(
    doc: DocumentInstanceDocument,
    transition: WorkflowTransition,
    opSteps: WorkflowStep[],
    elementConfigs: WorkflowElementConfig[],
    executorName: string,
  ): Promise<'in_progress' | 'published'> {
    const nextStep = opSteps.find((s) => s.orderIndex === transition.toStepOrderIndex) ?? null

    // Executa eventos intermediários (ex: conditional increment-revision)
    for (const eventId of transition.intermediateEventIds ?? []) {
      const handled = await this.executeIntermediateEvent(
        doc, eventId, elementConfigs, nextStep, executorName,
      )
      if (handled) return 'in_progress'
    }

    // Sem próximo step ou é etapa final → publica
    if (!nextStep || nextStep.isFinal) {
      await this.documentModel.findByIdAndUpdate(doc._id, {
        status: 'published', currentStepName: null, currentStepOrderIndex: null,
      })
      await this.addAuditLog(String(doc._id), 'DocumentoPublished', { userName: executorName })
      return 'published'
    }

    // Avança para o próximo step
    await this.documentModel.findByIdAndUpdate(doc._id, {
      status: 'in_progress',
      currentStepName: nextStep.name,
      currentStepOrderIndex: nextStep.orderIndex,
    })

    const updated = await this.documentModel.findById(doc._id)
    if (updated) await this.createTask(updated, nextStep, String(doc.createdById))

    return 'in_progress'
  }

  // ─── Executar ação de tarefa ──────────────────────────────────────────────

  async executeTaskAction(
    ctx: ExecuteActionContext,
    steps: WorkflowStep[],
    elementConfigs: WorkflowElementConfig[],
  ): Promise<{ success: boolean; status: string; documentId: string }> {
    const task = await this.taskModel.findById(ctx.taskId)
    if (!task) throw new NotFoundException(`Tarefa ${ctx.taskId} não encontrada`)
    if (task.status !== 'pending') throw new BadRequestException('Tarefa já concluída')

    const doc = await this.documentModel.findById(task.documentInstanceId)
    if (!doc) throw new NotFoundException('Documento não encontrado')

    if (ctx.outcome !== 'cancel') {
      await this.validateRequiredMetadata(String(doc._id), steps)
    }

    // Marca tarefa como concluída
    await this.taskModel.findByIdAndUpdate(ctx.taskId, {
      status: 'completed', actionTaken: ctx.outcome,
      comment: ctx.comment ?? null, completedAt: new Date(),
      allowedActions: [], taskActions: [],
    })

    const opSteps  = this.getOperationalSteps(steps)
    const currStep = opSteps.find((s) => s.orderIndex === doc.currentStepOrderIndex)
    const label    = currStep?.name ?? ''
    let status     = String(doc.status)

    // ── Cancelamento ────────────────────────────────────────────────────────
    if (ctx.outcome === 'cancel') {
      await this.documentModel.findByIdAndUpdate(doc._id, {
        status: 'cancelled', currentStepName: null, currentStepOrderIndex: null,
      })
      await this.addAuditLog(String(doc._id), 'DocumentoCancelled', {
        stepName: label, userName: ctx.executorName, comment: ctx.comment,
      })
      status = 'cancelled'
    }

    // ── Transição configurada ────────────────────────────────────────────────
    else if (currStep) {
      const transition = this.findTransition(currStep, ctx.outcome)

      if (transition) {
        status = await this.advanceDocument(doc, transition, opSteps, elementConfigs, ctx.executorName)
        const auditAction = status === 'published' ? 'DocumentoPublished' : 'TaskExecuted'
        await this.addAuditLog(String(doc._id), auditAction, {
          stepName: label, userName: ctx.executorName, comment: ctx.comment,
        })
      }
      else if (ctx.outcome === 'publish' || currStep.isFinal) {
        await this.documentModel.findByIdAndUpdate(doc._id, {
          status: 'published', currentStepName: null, currentStepOrderIndex: null,
        })
        await this.addAuditLog(String(doc._id), 'DocumentoPublished', {
          stepName: label, userName: ctx.executorName, comment: ctx.comment,
        })
        status = 'published'
      }
      else {
        // Avanço sequencial sem transição configurada
        const nextSeq = opSteps.find((s) => s.orderIndex === (currStep.orderIndex ?? 0) + 1)
        if (nextSeq) {
          await this.documentModel.findByIdAndUpdate(doc._id, {
            status: 'in_progress', currentStepName: nextSeq.name, currentStepOrderIndex: nextSeq.orderIndex,
          })
          const updated = await this.documentModel.findById(doc._id)
          if (updated) await this.createTask(updated, nextSeq, String(doc.createdById))
          await this.addAuditLog(String(doc._id), 'TaskExecuted', {
            stepName: label, userName: ctx.executorName, comment: ctx.comment,
          })
          status = 'in_progress'
        }
      }
    }

    return { success: true, status, documentId: String(doc._id) }
  }

  // ─── Validar metadados obrigatórios ───────────────────────────────────────

  private async validateRequiredMetadata(documentId: string, steps: WorkflowStep[]) {
    const doc = await this.documentModel.findById(documentId)
    if (!doc) return

    const opSteps  = this.getOperationalSteps(steps)
    const currStep = opSteps.find((s) => s.orderIndex === doc.currentStepOrderIndex)
    if (!currStep?.metadataFields?.length) return

    const saved = await this.metadataValueModel.find({
      documentInstanceId: new Types.ObjectId(documentId),
    })
    const savedMap = new Map(saved.map((v) => [v.metadataDefinitionId, v.value]))

    const missing = currStep.metadataFields
      .filter((f) => {
        if (!f.isRequired) return false
        const v = savedMap.get(f.metadataDefinitionId)
        if (v === null || v === undefined) return true
        if (typeof v === 'string' && !v.trim()) return true
        if (Array.isArray(v) && !v.length) return true
        return false
      })
      .map((f) => f.label ?? f.name ?? f.metadataDefinitionId)

    if (missing.length) {
      throw new BadRequestException(`Preencha os campos obrigatórios: ${missing.join(', ')}`)
    }
  }
}
