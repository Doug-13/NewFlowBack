import assert from 'node:assert/strict'
import { test } from 'node:test'
import { WorkflowTokenRuntimeService } from '../src/workflow-runtime/workflow-token-runtime.service'

/** Stateful in-memory Prisma boundary test. Database concurrency remains a separate acceptance test. */
test('2H: token avanca em ramo multipasso e AND une somente depois de ambos os ramos', async () => {
  const user = { id: 'admin', accountId: 'acc', role: 'admin', name: 'Admin' }
  const document: any = { id: 'doc', workflow_id: 'wf', account_id: 'acc', current_element_id: 'fork', status: 'in_progress' }
  const elements = [
    { element_id: 'a1', element_kind: 'userTask', name: 'A1', order_index: 1 },
    { element_id: 'a2', element_kind: 'userTask', name: 'A2', order_index: 2 },
    { element_id: 'b1', element_kind: 'userTask', name: 'B1', order_index: 3 },
    { element_id: 'join', element_kind: 'parallelGateway', name: 'Join', order_index: 4 },
    { element_id: 'done', element_kind: 'endEvent', name: 'Done', order_index: 5, is_end: true },
  ]
  const flows = [
    { source_element_id: 'a1', target_element_id: 'a2' },
    { source_element_id: 'a2', target_element_id: 'join' },
    { source_element_id: 'b1', target_element_id: 'join' },
    { source_element_id: 'join', target_element_id: 'done' },
  ]
  const tokens: any[] = [
    { id: 'token-a', account_id: 'acc', document_instance_id: 'doc', branch_key: 'a1', fork_key: 'fork', element_id: 'a1', join_element_id: 'join', status: 'active' },
    { id: 'token-b', account_id: 'acc', document_instance_id: 'doc', branch_key: 'b1', fork_key: 'fork', element_id: 'b1', join_element_id: 'join', status: 'active' },
  ]
  const history: any[] = []
  const prisma: any = {
    document_relations: { findMany: async () => [] },
    workflow_execution_tokens: {
      findFirst: async ({ where }: any) => tokens.find(t => t.id === where.id),
      findMany: async () => tokens.map(t => ({ ...t })),
      updateMany: async ({ where, data }: any) => {
        let count = 0
        for (const token of tokens) {
          if (Object.entries(where).every(([k, v]) => (token as any)[k] === v)) {
            Object.assign(token, data)
            count++
          }
        }
        return { count }
      },
    },
    workflow_elements: {
      findMany: async () => elements,
      findFirst: async ({ where }: any) => elements.find(e => e.element_id === where.element_id),
    },
    workflow_activity_actions: { findMany: async () => [{ action_key: 'complete', outcome: null, is_active: true }] },
    workflow_transitions: { findMany: async ({ where }: any) => where.source_element_id ? flows.filter(t => t.source_element_id === where.source_element_id) : flows },
    document_action_history: { create: async ({ data }: any) => history.push(data) },
    document_instances: {
      findFirst: async () => document,
      update: async ({ data }: any) => Object.assign(document, data),
    },
    $queryRaw: async () => [{ id: 'doc' }],
    $transaction: async (fn: any) => fn(prisma),
  }
  const runtime = new WorkflowTokenRuntimeService(prisma, { document: async () => document } as any, { resumeAfterChildFinished: async () => ({ resumed: 0 }) } as any)
  const first = await runtime.action(user, 'doc', 'token-a', { actionId: 'complete' })
  assert.deepEqual(first, { advanced: true, nextElementId: 'a2', joined: false })
  assert.equal(tokens[0].element_id, 'a2')
  assert.equal(tokens[0].status, 'active')
  assert.equal(document.current_element_id, 'fork')

  const second = await runtime.action(user, 'doc', 'token-b', { actionId: 'complete' })
  assert.equal(second.joined, false)
  assert.equal(tokens[1].status, 'arrived')

  const third = await runtime.action(user, 'doc', 'token-a', { actionId: 'complete' })
  assert.equal(third.joined, true)
  assert.equal(document.current_element_id, 'done')
  assert.equal(document.status, 'completed')
  assert.equal(tokens[0].status, 'completed')
  assert.equal(tokens[1].status, 'completed')
  assert.equal(history.length, 3)
})
