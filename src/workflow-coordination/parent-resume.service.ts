import { Injectable } from '@nestjs/common'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

const FINISHED = new Set(['completed', 'published', 'archived'])
const CLOSED = new Set(['completed', 'published', 'archived', 'cancelled'])

/**
 * Reconciles required subprocesses after a child reaches a final state.
 * A parent advances only when a waiting element and a unique next element
 * were derived from the SERVER workflow and persisted on its relation.
 * Safe to retry: parent row locks + conditional state update make it idempotent.
 */
@Injectable()
export class ParentResumeService {
  constructor(private readonly prisma: PrismaService) {}

  async resumeAfterChildFinished(accountId: string, childId: string): Promise<{ resumed: number }> {
    const links = await this.prisma.document_relations.findMany({
      where: { account_id: accountId, child_document_instance_id: childId,
        relation_type: 'subprocess', wait_for_completion: true },
      select: { parent_document_instance_id: true },
    })
    const parents = [...new Set(links.map(link => link.parent_document_instance_id))].sort()
    let resumed = 0
    for (const parentId of parents) {
      const changed = await this.prisma.$transaction(async tx => {
        // Lock each parent to serialize two children finishing simultaneously.
        await tx.$queryRaw`SELECT id FROM document_instances WHERE id = ${parentId}::uuid FOR UPDATE`
        const parent = await tx.document_instances.findFirst({ where: { id: parentId, account_id: accountId } })
        if (!parent || CLOSED.has(parent.status)) return false
        const required = await tx.document_relations.findMany({
          where: { account_id: accountId, parent_document_instance_id: parentId,
            relation_type: 'subprocess', wait_for_completion: true },
        })
        if (!required.length) return false
        const children = await tx.document_instances.findMany({
          where: { account_id: accountId, id: { in: required.map(r => r.child_document_instance_id) } },
          select: { id: true, status: true },
        })
        const states = new Map(children.map(c => [c.id, c.status]))
        const allDone = required.every(r => FINISHED.has(states.get(r.child_document_instance_id) ?? 'missing'))
        if (!allDone) return false

        // All required relationships must agree on a single, server-derived waiting route.
        const waits = new Set(required.map(r => r.parent_waiting_element_id))
        const nexts = new Set(required.map(r => r.parent_next_element_id))
        if (waits.size !== 1 || nexts.size !== 1) return false
        const waiting = required[0].parent_waiting_element_id
        const next = required[0].parent_next_element_id
        if (!waiting || !next || parent.current_element_id !== waiting) return false

        const active = await tx.workflow_execution_tokens.count({
          where: { account_id: accountId, document_instance_id: parentId,
            status: { in: ['active', 'arrived'] } },
        })
        if (active) return false
        // Revalidate persisted route against the workflow graph, not request parameters.
        const [transitions, target] = await Promise.all([
          tx.workflow_transitions.findMany({
            where: { workflow_id: parent.workflow_id, source_element_id: waiting },
            select: { target_element_id: true },
          }),
          tx.workflow_elements.findFirst({
            where: { workflow_id: parent.workflow_id, element_id: next },
          }),
        ])
        if (transitions.length !== 1 || transitions[0].target_element_id !== next ||
            !target || /gateway/i.test(target.element_kind ?? '')) return false

        const changed = await tx.document_instances.updateMany({
          where: { id: parentId, account_id: accountId, current_element_id: waiting,
            status: { notIn: [...CLOSED] } },
          data: { current_element_id: next, current_step_name: target.name,
            current_step_order_index: target.order_index,
            status: target.is_end || target.element_kind === 'endEvent' ? 'completed' : 'in_progress',
            updated_at: new Date() },
        })
        if (changed.count !== 1) return false
        await tx.document_relations.updateMany({
          where: { account_id: accountId, parent_document_instance_id: parentId,
            relation_type: 'subprocess', wait_for_completion: true },
          data: { status: 'completed', child_completed_at: new Date(),
            parent_continued_at: new Date(), updated_at: new Date() },
        })
        await tx.document_action_history.create({ data: {
          document_instance_id: parentId, element_id: waiting,
          action_id: 'subprocess.auto_resume',
          outcome: 'completed',
          comment: 'Todos os subprocessos obrigatorios foram concluidos.',
          executed_by_user_id: 'system', executed_by_user_name: 'NewFlow BPMN',
        } })
        return true
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      if (changed) resumed++
    }
    return { resumed }
  }
}
