import { ConflictException, Injectable } from '@nestjs/common'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ParentResumeService } from '../workflow-coordination/parent-resume.service'
import { deadlineRules, timerSeconds } from './workflow-schedule-policy'

const CLOSED = ['completed', 'published', 'archived', 'cancelled']
const FINISHED = ['completed', 'published', 'archived']
type Job = {
  id: string; account_id: string; document_instance_id: string; workflow_id: string;
  element_id: string; job_kind: string; idempotency_key: string
}
/** Phase 3B: timers and in-app notices only. No external messaging or scripts. */
@Injectable()
export class WorkflowScheduleService {
  constructor(private readonly prisma: PrismaService, private readonly parentResume: ParentResumeService) {}

  async execute(job: Job): Promise<'completed' | 'skipped'> {
    if (job.job_kind === 'timer') return this.fireTimer(job)
    if (job.job_kind === 'deadline' || job.job_kind === 'escalation') return this.sendNotice(job)
    throw new ConflictException('Tipo de agendamento nao suportado.')
  }

  private async fireTimer(job: Job): Promise<'completed' | 'skipped'> {
    const outcome = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM document_instances WHERE id = ${job.document_instance_id}::uuid FOR UPDATE`
      const document = await tx.document_instances.findFirst({ where: {
        id: job.document_instance_id, account_id: job.account_id,
      } })
      if (!document || document.workflow_id !== job.workflow_id || CLOSED.includes(document.status) || document.current_element_id !== job.element_id) return { result: 'skipped' as const, finished: false }
      const tokenCount = await tx.workflow_execution_tokens.count({ where: {
        account_id: job.account_id, document_instance_id: document.id, status: { in: ['active','arrived'] },
      } })
      if (tokenCount) throw new ConflictException('Temporizador em ramo paralelo ainda nao suportado.')
      const element = await tx.workflow_elements.findFirst({ where: {
        workflow_id: document.workflow_id, account_id: job.account_id, element_id: job.element_id,
      } })
      if (!element || timerSeconds(element) === null) return { result: 'skipped' as const, finished: false }
      const pending = await tx.document_relations.findMany({ where: {
        account_id: job.account_id, parent_document_instance_id: document.id,
        relation_type: 'subprocess', wait_for_completion: true,
      }, select: { child_document_instance_id: true } })
      if (pending.length) {
        const children = await tx.document_instances.findMany({ where: { account_id: job.account_id,
          id: { in: pending.map(r => r.child_document_instance_id) } }, select: { id: true, status: true } })
        const states = new Map(children.map(c => [c.id, c.status]))
        if (pending.some(r => !FINISHED.includes(states.get(r.child_document_instance_id) ?? 'missing'))) {
          throw new ConflictException('Temporizador bloqueado por subprocessos obrigatorios.')
        }
      }
      const transitions = await tx.workflow_transitions.findMany({ where: {
        workflow_id: document.workflow_id, account_id: job.account_id, source_element_id: job.element_id,
      } })
      if (transitions.length !== 1 || !transitions[0].target_element_id) throw new ConflictException('Temporizador exige uma unica transicao.')
      const target = await tx.workflow_elements.findFirst({ where: {
        workflow_id: document.workflow_id, account_id: job.account_id, element_id: transitions[0].target_element_id,
      } })
      if (!target || /gateway/i.test(target.element_kind ?? '') || /^serviceTask$/i.test(target.element_kind ?? '')) {
        throw new ConflictException('Destino do temporizador nao suportado nesta versao.')
      }
      const isEnd = Boolean(target.is_end || target.element_kind === 'endEvent')
      const changed = await tx.document_instances.updateMany({ where: {
        id: document.id, account_id: job.account_id, current_element_id: job.element_id,
        status: { notIn: CLOSED },
      }, data: { current_element_id: target.element_id, current_step_name: target.name,
        current_step_order_index: target.order_index, status: isEnd ? 'completed' : 'in_progress', updated_at: new Date() } })
      if (changed.count !== 1) throw new ConflictException('Documento alterado durante o timer.')
      await tx.document_action_history.create({ data: {
        document_instance_id: document.id, element_id: job.element_id,
        action_id: 'timer.fired', outcome: 'completed', comment: 'Temporizador BPMN disparado.',
        executed_by_user_id: 'system', executed_by_user_name: 'NewFlow Scheduler',
      } })
      return { result: 'completed' as const, finished: isEnd }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    if (outcome.finished) await this.parentResume.resumeAfterChildFinished(job.account_id, job.document_instance_id)
    return outcome.result
  }

  private async sendNotice(job: Job): Promise<'completed' | 'skipped'> {
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM document_instances WHERE id = ${job.document_instance_id}::uuid FOR UPDATE`
      const document = await tx.document_instances.findFirst({ where: {
        id: job.document_instance_id, account_id: job.account_id,
      } })
      if (!document || CLOSED.includes(document.status) || document.workflow_id !== job.workflow_id || document.current_element_id !== job.element_id) return 'skipped' as const
      const element = await tx.workflow_elements.findFirst({ where: {
        workflow_id: document.workflow_id, account_id: job.account_id, element_id: job.element_id,
      } })
      const rules = element ? deadlineRules(element) : null
      if (!rules) return 'skipped' as const
      if (job.job_kind === 'escalation' && rules.escalateAfterMinutes === null) return 'skipped' as const
      const recipient = job.job_kind === 'escalation' ? rules.escalateToUserId : document.current_assigned_user_id
      if (!recipient) return 'skipped' as const
      // Account-scoped recipient validation; never deliver to another account.
      const authorizedRecipient = await tx.users.findFirst({ where: {
        id: recipient, account_id: job.account_id, is_active: true,
      }, select: { id: true } })
      if (!authorizedRecipient) return 'skipped' as const
      const existing = await tx.workflow_notifications.findUnique({ where: { idempotency_key: job.idempotency_key } })
      if (existing) return 'completed' as const
      const escalated = job.job_kind === 'escalation'
      await tx.workflow_notifications.create({ data: {
        account_id: job.account_id, user_id: authorizedRecipient.id,
        document_instance_id: document.id, element_id: job.element_id,
        idempotency_key: job.idempotency_key, kind: job.job_kind,
        title: escalated ? 'Escalonamento de atividade' : 'Atividade vencida',
        message: escalated ? `Atividade ${element?.name ?? job.element_id} requer acompanhamento.`
          : `A atividade ${element?.name ?? job.element_id} ultrapassou o prazo.`,
      } })
      await tx.document_action_history.create({ data: {
        document_instance_id: document.id, element_id: job.element_id,
        action_id: escalated ? 'deadline.escalated' : 'deadline.notified',
        outcome: 'notified', executed_by_user_id: 'system', executed_by_user_name: 'NewFlow Scheduler',
        comment: escalated ? 'Escalonamento interno registrado.' : 'Notificacao interna de vencimento registrada.',
      } })
      return 'completed' as const
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }

  async notifications(user: any) {
    if (!user?.id || !user?.accountId) throw new ConflictException('Usuario sem identificacao.')
    return this.prisma.workflow_notifications.findMany({
      where: { account_id: user.accountId, user_id: user.id },
      orderBy: { created_at: 'desc' }, take: 100,
      select: { id: true, document_instance_id: true, element_id: true, kind: true,
        title: true, message: true, is_read: true, created_at: true, read_at: true },
    })
  }

  async markRead(user: any, id: string) {
    if (!user?.id || !user?.accountId) throw new ConflictException('Usuario sem identificacao.')
    const result = await this.prisma.workflow_notifications.updateMany({ where: {
      id, account_id: user.accountId, user_id: user.id, is_read: false,
    }, data: { is_read: true, read_at: new Date() } })
    return { updated: result.count }
  }
}
