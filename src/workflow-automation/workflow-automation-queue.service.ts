import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ParentResumeService } from '../workflow-coordination/parent-resume.service'
import { WorkflowAutomationService } from './workflow-automation.service'
import { automationJobKey, failureDisposition, isNoopAutomation, retryDelayMs } from './automation-job-policy'
import { WorkflowScheduleService } from './workflow-schedule.service'
import { WorkflowEventService } from './workflow-event.service'
import { WorkflowHttpService } from './workflow-http.service'
import { parseHttpAutomation } from './workflow-http-policy'
import { planSchedules } from './workflow-schedule-policy'
import type { ScheduleKind } from './workflow-schedule-policy'

/** Persisted, opt-in worker. No arbitrary scripts, external HTTP or side effects are executed. */
@Injectable()
export class WorkflowAutomationQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkflowAutomationQueueService.name)
  private timer?: ReturnType<typeof setInterval>
  private busy = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly automation: WorkflowAutomationService,
    private readonly parentResume: ParentResumeService,
    @Optional() private readonly schedule?: WorkflowScheduleService,
    @Optional() private readonly events?: WorkflowEventService,
    @Optional() private readonly http?: WorkflowHttpService,
  ) {}

  onModuleInit() {
    if (process.env.NEWFLOW_AUTOMATION_WORKER_ENABLED !== 'true') return
    this.logger.log('Worker de automacoes habilitado; somente noop/serviceTask.')
    this.timer = setInterval(() => { void this.tick().catch(err => this.logger.error(err)) }, 10000)
    this.timer.unref?.()
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  private async tick() {
    if (this.busy) return
    this.busy = true
    try {
      await this.discover()
      await this.process(10)
    } finally {
      this.busy = false
    }
  }

  private async register(accountId: string, documentId: string, workflowId: string, elementId: string, tokenId?: string) {
    const key = automationJobKey(documentId, elementId, tokenId)
    await this.prisma.workflow_automation_jobs.upsert({
      where: { idempotency_key: key }, update: {},
      create: { account_id: accountId, document_instance_id: documentId, workflow_id: workflowId,
        element_id: elementId, token_id: tokenId ?? null, idempotency_key: key,
        status: 'queued', max_attempts: 5 },
    })
  }

  private async registerSchedule(accountId: string, documentId: string, workflowId: string,
    elementId: string, kind: ScheduleKind, availableAt: Date) {
    const key = `${automationJobKey(documentId, elementId)}:${kind}`
    await this.prisma.workflow_automation_jobs.upsert({
      where: { idempotency_key: key }, update: {},
      create: { account_id: accountId, document_instance_id: documentId, workflow_id: workflowId,
        element_id: elementId, token_id: null, idempotency_key: key,
        job_kind: kind, status: 'queued', max_attempts: 5, available_at: availableAt },
    })
  }

  /** Bounded scan, tenant-scoped when called by the admin endpoint. Re-scans are idempotent. */
  async discover(accountId?: string): Promise<{ discovered: number }> {
    let discovered = 0
    const docs = await this.prisma.document_instances.findMany({
      where: { ...(accountId ? { account_id: accountId } : {}),
        status: { in: ['draft', 'in_progress'] }, current_element_id: { not: null } },
      select: { id: true, account_id: true, workflow_id: true, current_element_id: true, updated_at: true },
      orderBy: { updated_at: 'desc' }, take: 200,
    })
    for (const doc of docs) {
      const active = await this.prisma.workflow_execution_tokens.count({
        where: { account_id: doc.account_id, document_instance_id: doc.id,
          status: { in: ['active', 'arrived'] } },
      })
      if (active) continue
      const element = await this.prisma.workflow_elements.findFirst({
        where: { workflow_id: doc.workflow_id, account_id: doc.account_id, element_id: doc.current_element_id! },
      })
      if (parseHttpAutomation(element)) {
        const key = automationJobKey(doc.id, doc.current_element_id!) + ':http'
        await this.prisma.workflow_automation_jobs.upsert({
          where: { idempotency_key: key }, update: {},
          create: { account_id: doc.account_id, document_instance_id: doc.id, workflow_id: doc.workflow_id,
            element_id: doc.current_element_id!, token_id: null, idempotency_key: key, job_kind: 'http', status: 'queued', max_attempts: 5 },
        })
        discovered++
      } else if (isNoopAutomation(element)) {
        await this.register(doc.account_id, doc.id, doc.workflow_id, doc.current_element_id!)
        discovered++
      } else if (element) {
        // Timers/deadlines are only supported on the single-document path, not on active token branches.
        for (const plan of planSchedules(element, doc.updated_at)) {
          await this.registerSchedule(doc.account_id, doc.id, doc.workflow_id, doc.current_element_id!, plan.kind, plan.availableAt)
          discovered++
        }
      }
    }
    const tokens = await this.prisma.workflow_execution_tokens.findMany({
      where: { ...(accountId ? { account_id: accountId } : {}), status: 'active' },
      select: { id: true, account_id: true, document_instance_id: true, element_id: true },
      orderBy: { updated_at: 'desc' }, take: 200,
    })
    for (const token of tokens) {
      const doc = await this.prisma.document_instances.findFirst({
        where: { id: token.document_instance_id, account_id: token.account_id,
          status: { in: ['draft', 'in_progress'] } },
        select: { workflow_id: true },
      })
      if (!doc) continue
      const element = await this.prisma.workflow_elements.findFirst({
        where: { workflow_id: doc.workflow_id, account_id: token.account_id, element_id: token.element_id },
      })
      if (!isNoopAutomation(element)) continue
      await this.register(token.account_id, token.document_instance_id, doc.workflow_id, token.element_id, token.id)
      discovered++
    }
    return { discovered }
  }

  /** Atomic claim across multiple server instances. Timed-out leases can be reclaimed. */
  private async claim(accountId?: string) {
    const selected = await this.prisma.$queryRaw<Array<{ id: string }>>`
      WITH claimed AS (
        SELECT id FROM workflow_automation_jobs
        WHERE (${accountId ?? null}::text IS NULL OR account_id = ${accountId ?? null})
          AND (
            (status IN ('queued', 'retry') AND available_at <= NOW())
            OR (status = 'running' AND locked_at < NOW() - INTERVAL '5 minutes')
          )
        ORDER BY available_at, created_at, id
        FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE workflow_automation_jobs AS job
      SET status = 'running', locked_at = NOW(), attempt_count = attempt_count + 1, updated_at = NOW()
      FROM claimed WHERE job.id = claimed.id
      RETURNING job.id
    `
    if (!selected.length) return null
    return this.prisma.workflow_automation_jobs.findUnique({ where: { id: selected[0].id } })
  }

  private async previouslyExecuted(job: { document_instance_id: string; element_id: string }) {
    return Boolean(await this.prisma.document_action_history.findFirst({ where: {
      document_instance_id: job.document_instance_id, element_id: job.element_id,
      action_id: 'automation.noop',
    } }))
  }

  private async executeJob(job: {
    id: string; account_id: string; document_instance_id: string; workflow_id: string;
    element_id: string; token_id: string | null; job_kind: string; idempotency_key: string; event_id: string | null
  }): Promise<'completed' | 'skipped'> {
    const document = await this.prisma.document_instances.findFirst({
      where: { id: job.document_instance_id, account_id: job.account_id },
    })
    if (!document || document.workflow_id !== job.workflow_id) return 'skipped'
    if (job.job_kind === 'http') {
      if (!this.http) throw new Error('Servico de integracoes HTTP nao configurado.')
      return this.http.execute(job)
    }
    if (job.job_kind === 'event') {
      if (!this.events) throw new Error('Motor de eventos nao configurado.')
      return this.events.execute(job)
    }
    if (job.job_kind && job.job_kind !== 'noop') {
      if (!this.schedule) throw new Error('Servico de agendamentos nao configurado.')
      return this.schedule.execute(job)
    }
    const actor = { id: 'system', name: 'NewFlow Automation', role: 'admin', accountId: job.account_id }
    if (job.token_id) {
      const token = await this.prisma.workflow_execution_tokens.findFirst({
        where: { id: job.token_id, document_instance_id: document.id, account_id: job.account_id },
      })
      if (!token || token.status !== 'active' || token.element_id !== job.element_id) {
        if (await this.previouslyExecuted(job)) {
          if (['completed', 'published', 'archived'].includes(document.status)) {
            await this.parentResume.resumeAfterChildFinished(job.account_id, document.id)
          }
          return 'completed'
        }
        return 'skipped'
      }
      await this.automation.executeToken(actor, document.id, token.id)
      return 'completed'
    }
    if (document.current_element_id !== job.element_id || ['completed','published','archived','cancelled'].includes(document.status)) {
      if (await this.previouslyExecuted(job)) {
        if (['completed', 'published', 'archived'].includes(document.status)) {
          await this.parentResume.resumeAfterChildFinished(job.account_id, document.id)
        }
        return 'completed'
      }
      return 'skipped'
    }
    await this.automation.execute(actor, document.id)
    return 'completed'
  }

  async process(limit = 10, accountId?: string) {
    const max = Math.max(1, Math.min(20, Math.floor(limit)))
    const result = { processed: 0, completed: 0, skipped: 0, retried: 0, dead: 0 }
    for (let i = 0; i < max; i++) {
      const job = await this.claim(accountId)
      if (!job) break
      result.processed++
      try {
        const status = await this.executeJob(job)
        await this.prisma.workflow_automation_jobs.updateMany({
          where: { id: job.id, status: 'running', attempt_count: job.attempt_count },
          data: { status, locked_at: null, finished_at: new Date(), last_error: null, updated_at: new Date() },
        })
        if (status === 'completed') result.completed++
        else result.skipped++
      } catch (error) {
        const status = failureDisposition(job.attempt_count, job.max_attempts)
        const message = error instanceof Error ? error.message : String(error)
        await this.prisma.workflow_automation_jobs.updateMany({
          where: { id: job.id, status: 'running', attempt_count: job.attempt_count },
          data: { status, locked_at: null,
            available_at: new Date(Date.now() + retryDelayMs(job.attempt_count)),
            last_error: message.slice(0, 2000), updated_at: new Date(),
            finished_at: status === 'dead' ? new Date() : null },
        })
        if (status === 'retry') result.retried++
        else result.dead++
        this.logger.warn(`Job ${job.id} status=${status}: ${message}`)
      }
    }
    return result
  }

  async list(accountId: string) {
    return this.prisma.workflow_automation_jobs.findMany({
      where: { account_id: accountId }, orderBy: { created_at: 'desc' }, take: 100,
      select: { id: true, document_instance_id: true, element_id: true, token_id: true, job_kind: true,
        status: true, attempt_count: true, max_attempts: true, available_at: true,
        finished_at: true, last_error: true, created_at: true },
    })
  }
}
