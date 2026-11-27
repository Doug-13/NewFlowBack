import { ConflictException, Injectable } from '@nestjs/common'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ParentResumeService } from '../workflow-coordination/parent-resume.service'
import { WorkflowHttpClient } from './workflow-http-client'
import { parseHttpAutomation } from './workflow-http-policy'

const CLOSED = ['completed', 'published', 'archived', 'cancelled']
type Job = { id: string; account_id: string; document_instance_id: string; workflow_id: string; element_id: string; token_id: string | null; idempotency_key: string }

/** 3D: HTTP serviceTask, single-document path only. External APIs MUST honor x-idempotency-key. */
@Injectable()
export class WorkflowHttpService {
  constructor(private readonly prisma: PrismaService, private readonly client: WorkflowHttpClient,
    private readonly parentResume: ParentResumeService) {}

  async execute(job: Job): Promise<'completed' | 'skipped'> {
    // Preflight: never hold a database transaction open across a network call.
    const doc = await this.prisma.document_instances.findFirst({ where: { id: job.document_instance_id, account_id: job.account_id } })
    if (!doc || doc.workflow_id !== job.workflow_id || doc.current_element_id !== job.element_id || CLOSED.includes(doc.status)) return 'skipped'
    if (job.token_id) throw new ConflictException('HTTP em ramo paralelo nao suportado.')
    const active = await this.prisma.workflow_execution_tokens.count({ where: { account_id: job.account_id, document_instance_id: doc.id, status: { in: ['active','arrived'] } } })
    if (active) throw new ConflictException('HTTP em ramo paralelo nao suportado.')
    const element = await this.prisma.workflow_elements.findFirst({ where: { workflow_id: doc.workflow_id, account_id: job.account_id, element_id: job.element_id } })
    const config = parseHttpAutomation(element)
    if (!config) throw new ConflictException('Configuracao HTTP nao habilitada ou destino nao autorizado.')
    // Validate graph before triggering a side effect.
    const transitions = await this.prisma.workflow_transitions.findMany({ where: { workflow_id: doc.workflow_id, account_id: job.account_id, source_element_id: job.element_id } })
    if (transitions.length !== 1 || !transitions[0].target_element_id) throw new ConflictException('HTTP exige exatamente uma transicao.')
    const target = await this.prisma.workflow_elements.findFirst({ where: { workflow_id: doc.workflow_id, account_id: job.account_id, element_id: transitions[0].target_element_id } })
    if (!target || /gateway/i.test(target.element_kind ?? '') || /^serviceTask$/i.test(target.element_kind ?? '')) throw new ConflictException('Destino HTTP nao suportado.')
    // Retry after a DB crash may resend the HTTP request. Idempotency is the receiver's duty.
    await this.client.send(config, job.idempotency_key, doc.id)

    const result = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM document_instances WHERE id = ${doc.id}::uuid FOR UPDATE`
      const current = await tx.document_instances.findFirst({ where: { id: doc.id, account_id: job.account_id } })
      if (!current || current.current_element_id !== job.element_id || CLOSED.includes(current.status)) return { status: 'skipped' as const, finished: false }
      const changed = await tx.document_instances.updateMany({ where: { id: doc.id, account_id: job.account_id, current_element_id: job.element_id, status: { notIn: CLOSED } }, data: {
        current_element_id: target.element_id, current_step_name: target.name, current_step_order_index: target.order_index,
        status: target.is_end || target.element_kind === 'endEvent' ? 'completed' : 'in_progress', updated_at: new Date(),
      } })
      if (changed.count !== 1) throw new ConflictException('Estado alterado durante chamada HTTP.')
      await tx.document_action_history.create({ data: { document_instance_id: doc.id, element_id: job.element_id,
        action_id: 'automation.http', outcome: 'completed', comment: 'Integracao HTTPS concluida; URL e credencial omitidas.',
        executed_by_user_id: 'system', executed_by_user_name: 'NewFlow HTTP Worker',
      } })
      return { status: 'completed' as const, finished: Boolean(target.is_end || target.element_kind === 'endEvent') }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000, maxWait: 10000 })
    if (result.finished) await this.parentResume.resumeAfterChildFinished(job.account_id, doc.id)
    return result.status
  }
}
