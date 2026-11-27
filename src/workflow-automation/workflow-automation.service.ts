import { ConflictException, Injectable, Optional } from '@nestjs/common'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ResourceAccessService } from '../security/resource-access.service'
import { ParentResumeService } from '../workflow-coordination/parent-resume.service'
import { WorkflowTokenRuntimeService } from '../workflow-runtime/workflow-token-runtime.service'
import { isNoopAutomation } from './automation-job-policy'

const CLOSED = ['completed', 'published', 'archived', 'cancelled']
const FINISHED = ['completed', 'published', 'archived']

/**
 * Phase 3A.1: an explicit, admin-only, safe automatic no-op task.
 * No scripts, HTTP requests or user-controlled actions are executed.
 * The document transition and its audit record share one serializable transaction.
 */
@Injectable()
export class WorkflowAutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ResourceAccessService,
    private readonly parentResume: ParentResumeService,
    @Optional() private readonly runtime?: WorkflowTokenRuntimeService,
  ) {}

  async execute(user: any, documentId: string) {
    this.access.assertAdmin(user)
    // The access check must happen before any database mutation.
    const visible = await this.access.document(user, documentId, 'admin')
    const id = visible.id
    const result = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM document_instances WHERE id = ${id}::uuid FOR UPDATE`
      const document = await tx.document_instances.findFirst({
        where: { id, account_id: user.accountId },
      })
      if (!document || CLOSED.includes(document.status)) {
        throw new ConflictException('Documento ausente ou encerrado.')
      }
      const activeTokens = await tx.workflow_execution_tokens.count({
        where: { account_id: user.accountId, document_instance_id: id,
          status: { in: ['active', 'arrived'] } },
      })
      if (activeTokens) throw new ConflictException('Documento utiliza motor de tokens. Automacao simples indisponivel.')

      const relations = await tx.document_relations.findMany({
        where: { account_id: user.accountId, parent_document_instance_id: id,
          relation_type: 'subprocess', wait_for_completion: true },
        select: { child_document_instance_id: true },
      })
      if (relations.length) {
        const children = await tx.document_instances.findMany({
          where: { account_id: user.accountId, id: { in: relations.map(r => r.child_document_instance_id) } },
          select: { id: true, status: true },
        })
        const states = new Map(children.map(c => [c.id, c.status]))
        if (relations.some(r => !FINISHED.includes(states.get(r.child_document_instance_id) ?? 'missing'))) {
          throw new ConflictException('Subprocessos obrigatorios ainda pendentes.')
        }
      }
      const current = await tx.workflow_elements.findFirst({
        where: { workflow_id: document.workflow_id, account_id: user.accountId,
          element_id: document.current_element_id ?? '' },
      })
      if (!current || !/^serviceTask$/i.test(current.element_kind ?? '')) {
        throw new ConflictException('A etapa atual nao e uma serviceTask.')
      }
      if (!isNoopAutomation(current)) {
        throw new ConflictException('ServiceTask sem automacao noop habilitada no servidor.')
      }
      const outgoing = await tx.workflow_transitions.findMany({
        where: { workflow_id: document.workflow_id, account_id: user.accountId,
          source_element_id: current.element_id },
      })
      if (outgoing.length !== 1 || !outgoing[0].target_element_id) {
        throw new ConflictException('ServiceTask automatica exige exatamente uma transicao.')
      }
      const target = await tx.workflow_elements.findFirst({
        where: { workflow_id: document.workflow_id, account_id: user.accountId,
          element_id: outgoing[0].target_element_id },
      })
      if (!target || /gateway/i.test(target.element_kind ?? '') ||
          /^serviceTask$/i.test(target.element_kind ?? '')) {
        throw new ConflictException('Destino ausente ou exige outro mecanismo de execucao.')
      }
      const isEnd = Boolean(target.is_end || target.element_kind === 'endEvent')
      const changed = await tx.document_instances.updateMany({
        where: { id, account_id: user.accountId, current_element_id: current.element_id,
          status: { notIn: CLOSED } },
        data: { current_element_id: target.element_id,
          current_step_name: target.name,
          current_step_order_index: target.order_index,
          status: isEnd ? 'completed' : 'in_progress', updated_at: new Date() },
      })
      if (changed.count !== 1) throw new ConflictException('Estado do documento mudou durante a automacao.')
      await tx.document_action_history.create({ data: {
        document_instance_id: id,
        element_id: current.element_id,
        step_name: current.name,
        step_order_index: current.order_index,
        action_id: 'automation.noop', outcome: 'completed',
        comment: 'ServiceTask noop executada pelo motor automatico.',
        executed_by_user_id: 'system', executed_by_user_name: 'NewFlow Automation',
      } })
      return { executed: true, documentInstanceId: id,
        fromElementId: current.element_id, nextElementId: target.element_id,
        completed: isEnd }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    if (result.completed) {
      // Do not roll back a committed task if the parent's reconciliation fails.
      // A later reconciliation can retry; return an error so operators are notified.
      await this.parentResume.resumeAfterChildFinished(user.accountId, id)
    }
    return result
  }

  /** Token-aware, server-configured noop; the token runtime still validates the full branch graph. */
  async executeToken(user: any, documentId: string, tokenId: string) {
    this.access.assertAdmin(user)
    if (!this.runtime) throw new ConflictException('Motor de tokens nao configurado.')
    const document = await this.access.document(user, documentId, 'admin')
    const token = await this.prisma.workflow_execution_tokens.findFirst({
      where: { id: tokenId, account_id: user.accountId, document_instance_id: document.id, status: 'active' },
    })
    if (!token) throw new ConflictException('Token automatico nao esta ativo.')
    const element = await this.prisma.workflow_elements.findFirst({
      where: { workflow_id: document.workflow_id, account_id: user.accountId, element_id: token.element_id },
    })
    if (!isNoopAutomation(element)) throw new ConflictException('Token nao e serviceTask noop habilitada.')
    const actions = await this.prisma.workflow_activity_actions.findMany({
      where: { workflow_id: document.workflow_id, element_id: token.element_id },
    })
    // No client-supplied action/outcome. Only one safe action is allowed for the automation.
    if (actions.length > 0 && (actions.length !== 1 || actions[0].is_active === false ||
      actions[0].requires_comment || actions[0].requires_attachment || actions[0].action_key !== 'automation.noop')) {
      throw new ConflictException('serviceTask automatica exige acao unica automation.noop.')
    }
    return this.runtime.action(user, document.id, tokenId, { actionId: 'automation.noop' })
  }

}
