import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ResourceAccessService } from '../security/resource-access.service'
import { enforceWorkflowAssignee } from './assignment-access'
import { authorizeWorkflowAction, chooseWorkflowTransition } from './transition-policy'
import { planGateway } from './gateway-policy'
import { decideParallelJoin } from './token-coordination-policy'
import { validateLinearAndBranches } from './branch-path-policy'

/** Controlled first release of the persisted BPMN token runtime.
 * Activation requires a gateway with a server-stored config.joinElementId.
 * One AND fork/join cohort per document, with linear multi-activity branches; nested gateways remain blocked.
 */
@Injectable()
export class WorkflowTokenRuntimeService {
  constructor(private readonly prisma: PrismaService, private readonly access: ResourceAccessService) {}

  private async owned(user: any, documentId: string) {
    return this.access.document(user, documentId, 'read')
  }

  async list(user: any, documentId: string) {
    await this.owned(user, documentId)
    return this.prisma.workflow_execution_tokens.findMany({
      where: { account_id: user.accountId, document_instance_id: documentId },
      orderBy: { created_at: 'asc' },
      select: { id: true, element_id: true, branch_key: true, fork_key: true, join_element_id: true, status: true, arrived_at: true },
    })
  }

  /** Check child status in the source-of-truth documents table, not the cached relation status. */
  private async assertNoPendingChildren(user: any, documentId: string) {
    const required = await this.prisma.document_relations.findMany({
      where: { account_id: user.accountId, parent_document_instance_id: documentId,
        relation_type: 'subprocess', wait_for_completion: true },
      select: { child_document_instance_id: true },
    })
    if (!required.length) return
    const children = await this.prisma.document_instances.findMany({
      where: {account_id: user.accountId, id: {in: required.map(r => r.child_document_instance_id)}},
      select: {id: true, status: true},
    })
    const states = new Map(children.map(c => [c.id, c.status]))
    if (required.some(r => !['completed','published','archived'].includes(states.get(r.child_document_instance_id) ?? 'missing'))) {
      throw new ConflictException('Subprocessos obrigatorios ainda pendentes.')
    }
  }

  /** Starting a fork is explicit: no guessing of joins or implicit rerouting. */
  async start(user: any, documentId: string) {
    const document = await this.owned(user, documentId)
    if (String(user.role ?? '').toLowerCase() !== 'admin') throw new ForbiddenException('A inicializacao do fork exige administrador nesta versao.')
    await this.assertNoPendingChildren(user, documentId)
    if (['cancelled','completed','published','archived'].includes(document.status)) throw new ConflictException('Documento encerrado.')
    const gateway = await this.prisma.workflow_elements.findFirst({
      where: { workflow_id: document.workflow_id, element_id: document.current_element_id ?? '' },
    })
    if (!gateway) throw new NotFoundException('Atividade atual nao existe no workflow.')
    const joinElementId = String((gateway.config as any)?.joinElementId ?? '').trim()
    if (!joinElementId) throw new ConflictException('Gateway exige joinElementId configurado no servidor.')
    const [flows, join] = await Promise.all([
      this.prisma.workflow_transitions.findMany({ where: { workflow_id: document.workflow_id, source_element_id: gateway.element_id } }),
      this.prisma.workflow_elements.findFirst({ where: { workflow_id: document.workflow_id, element_id: joinElementId } }),
    ])
    if (!join || !/parallelgateway/i.test(join.element_kind)) throw new ConflictException('Gateway de juncao invalido.')
    const plan = planGateway(gateway, flows, null)
    if (!plan || plan.kind !== 'parallel') throw new ConflictException('Primeira versao suporta apenas fork paralelo AND.')
    if (plan.targetElementIds.length < 2 || new Set(plan.targetElementIds).size !== plan.targetElementIds.length) {
      throw new ConflictException('Fork precisa de dois ou mais caminhos distintos.')
    }
    // Validate the complete linear graph before persisting any tokens.
    // Nested gateways, cycles, cross-branch merges and ambiguous transitions stay blocked.
    const [allElements, allTransitions] = await Promise.all([
      this.prisma.workflow_elements.findMany({ where: { workflow_id: document.workflow_id } }),
      this.prisma.workflow_transitions.findMany({ where: { workflow_id: document.workflow_id } }),
    ])
    validateLinearAndBranches(plan.targetElementIds, joinElementId, allElements, allTransitions)
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM document_instances WHERE id = ${documentId}::uuid FOR UPDATE`
      const current = await tx.document_instances.findFirst({where: {id: documentId, account_id: user.accountId}})
      if (!current || current.current_element_id !== gateway.element_id) throw new ConflictException('Estado do documento foi alterado.')
      const already = await tx.workflow_execution_tokens.count({where: {document_instance_id: documentId}})
      if (already) throw new ConflictException('Documento ja possui tokens. Nao repetir fork.')
      for (const id of plan.targetElementIds) {
        await tx.workflow_execution_tokens.create({ data: {
          account_id: user.accountId, document_instance_id: documentId,
          fork_key: gateway.element_id, branch_key: id, element_id: id,
          join_element_id: joinElementId, status: 'active',
        } })
      }
      await tx.document_instances.update({where: {id: documentId}, data: {status: 'in_progress', updated_at: new Date()}})
      return {started: true, active: plan.targetElementIds.length, joinElementId}
    }, {isolationLevel: Prisma.TransactionIsolationLevel.Serializable})
  }

  async action(user: any, documentId: string, tokenId: string, body: any) {
    const document = await this.owned(user, documentId)
    await this.assertNoPendingChildren(user, documentId)
    if (['cancelled','completed','published','archived'].includes(document.status)) throw new ConflictException('Documento encerrado.')
    const token = await this.prisma.workflow_execution_tokens.findFirst({
      where: {id: tokenId, account_id: user.accountId, document_instance_id: documentId},
    })
    if (!token || token.status !== 'active') throw new ConflictException('Token inexistente ou concluido.')
    const isAdmin = String(user.role ?? '').toLowerCase() === 'admin'
    if (!isAdmin) {
      // Evaluate authorization using the token activity rather than the legacy single current_element_id.
      await enforceWorkflowAssignee(this.prisma, user, {
        workflow_id: document.workflow_id, current_element_id: token.element_id,
        current_assigned_user_id: null,
      })
    }
    const [configuredActions, transitions] = await Promise.all([
      this.prisma.workflow_activity_actions.findMany({where: {workflow_id: document.workflow_id, element_id: token.element_id}}),
      this.prisma.workflow_transitions.findMany({where: {workflow_id: document.workflow_id, source_element_id: token.element_id}}),
    ])
    const policy = authorizeWorkflowAction(configuredActions, body)
    const selected = chooseWorkflowTransition(transitions, policy.outcome, policy.targetId)
    // The branch must remain a valid linear chain. Avoid allowing a mutated
    // workflow definition to route a token into another branch or a gateway.
    const [allElements, allTransitions, cohortBefore] = await Promise.all([
      this.prisma.workflow_elements.findMany({ where: { workflow_id: document.workflow_id } }),
      this.prisma.workflow_transitions.findMany({ where: { workflow_id: document.workflow_id } }),
      this.prisma.workflow_execution_tokens.findMany({
        where: { account_id: user.accountId, document_instance_id: documentId, fork_key: token.fork_key },
      }),
    ])
    const branches = validateLinearAndBranches(cohortBefore.map(t => t.branch_key), token.join_element_id, allElements, allTransitions)
    const path = branches.get(token.branch_key)
    const position = path?.indexOf(token.element_id) ?? -1
    if (position < 0 || selected.target_element_id !== (path![position + 1] ?? token.join_element_id)) {
      throw new ConflictException('Transicao nao pertence a sequencia validada deste ramo.')
    }
    const reachesJoin = selected.target_element_id === token.join_element_id
    return this.prisma.$transaction(async tx => {
      // Serialize all token updates for this document, including concurrent branch completions.
      await tx.$queryRaw`SELECT id FROM document_instances WHERE id = ${documentId}::uuid FOR UPDATE`
      const latest = await tx.document_instances.findFirst({where: {id: documentId, account_id: user.accountId}})
      if (!latest || ['cancelled','completed','published','archived'].includes(latest.status)) throw new ConflictException('Documento encerrado.')
      const updated = await tx.workflow_execution_tokens.updateMany({
        where: {id: tokenId, account_id: user.accountId, document_instance_id: documentId,
          status: 'active', element_id: token.element_id},
        data: reachesJoin
          ? {status: 'arrived', arrived_at: new Date(), updated_at: new Date()}
          : {element_id: selected.target_element_id, updated_at: new Date()},
      })
      if (updated.count !== 1) throw new ConflictException('Token ja executado. Atualize a tela.')
      await tx.document_action_history.create({data: {
        document_instance_id: documentId, element_id: token.element_id,
        action_id: policy.actionKey, outcome: policy.outcome,
        comment: typeof body.comment === 'string' ? body.comment : null,
        executed_by_user_id: user.id, executed_by_user_name: user.name,
      }})
      if (!reachesJoin) {
        return { advanced: true, nextElementId: selected.target_element_id, joined: false }
      }
      const cohort = await tx.workflow_execution_tokens.findMany({
        where: {account_id: user.accountId, document_instance_id: documentId, fork_key: token.fork_key},
      })
      const decision = decideParallelJoin(cohort.map(t => ({
        branchKey: t.branch_key, elementId: t.element_id,
        status: t.status as 'active'|'arrived'|'completed'|'cancelled',
        forkKey: t.fork_key, joinElementId: t.join_element_id,
      })), token.fork_key, token.join_element_id)
      if (!decision.ready) return {arrived: decision.arrived, expected: decision.expected, joined: false}
      const [join, outgoing] = await Promise.all([
        tx.workflow_elements.findFirst({where: {workflow_id: document.workflow_id, element_id: token.join_element_id}}),
        tx.workflow_transitions.findMany({where: {workflow_id: document.workflow_id, source_element_id: token.join_element_id}}),
      ])
      if (!join || !/parallelgateway/i.test(join.element_kind)) throw new ConflictException('Join paralelo AND invalido.')
      if (outgoing.length !== 1) throw new ConflictException('Join precisa de uma unica saida nesta versao.')
      const target = await tx.workflow_elements.findFirst({where: {workflow_id: document.workflow_id, element_id: outgoing[0].target_element_id}})
      if (!target || /gateway/i.test(target.element_kind)) throw new ConflictException('Destino apos join invalido ou gateway encadeado.')
      await tx.workflow_execution_tokens.updateMany({
        where: {account_id: user.accountId, document_instance_id: documentId, fork_key: token.fork_key, status: 'arrived'},
        data: {status: 'completed', updated_at: new Date()},
      })
      await tx.document_instances.update({where: {id: documentId}, data: {
        current_element_id: target.element_id, current_step_name: target.name,
        current_step_order_index: target.order_index,
        status: target.is_end || target.element_kind === 'endEvent' ? 'completed' : 'in_progress',
        updated_at: new Date(),
      }})
      return {arrived: decision.arrived, expected: decision.expected, joined: true, nextElementId: target.element_id}
    }, {isolationLevel: Prisma.TransactionIsolationLevel.Serializable})
  }
}
