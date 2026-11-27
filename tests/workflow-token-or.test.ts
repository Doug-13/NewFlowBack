import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ConflictException } from '@nestjs/common'
import { validateLinearTokenBranches } from '../src/workflow-runtime/branch-path-policy'
import { WorkflowTokenRuntimeService } from '../src/workflow-runtime/workflow-token-runtime.service'

const elements = [
  { element_id: 'a1', element_kind: 'userTask' },
  { element_id: 'a2', element_kind: 'userTask' },
  { element_id: 'b1', element_kind: 'userTask' },
  { element_id: 'join', element_kind: 'inclusiveGateway' },
]
const transitions = [
  { source_element_id: 'a1', target_element_id: 'a2' },
  { source_element_id: 'a2', target_element_id: 'join' },
  { source_element_id: 'b1', target_element_id: 'join' },
]

test('2I: OR permite apenas uma ramificacao ativa no join', () => {
  const result = validateLinearTokenBranches(['a1'], 'join', elements, transitions, 'inclusive')
  assert.deepEqual(result.get('a1'), ['a1', 'a2'])
})
test('2I: OR permite dois ramos ativos com join unico', () => {
  const result = validateLinearTokenBranches(['a1', 'b1'], 'join', elements, transitions, 'inclusive')
  assert.deepEqual(result.get('b1'), ['b1'])
})
test('2I: OR rejeita join de tipo incorreto', () => {
  assert.throws(() => validateLinearTokenBranches(['a1'], 'join',
    [...elements.slice(0, 3), { element_id: 'join', element_kind: 'parallelGateway' }], transitions, 'inclusive'), ConflictException)
})
test('2I: AND continua exigindo dois ramos', () => {
  assert.throws(() => validateLinearTokenBranches(['a1'], 'join', elements, transitions, 'parallel'), ConflictException)
})
test('2I: OR rejeita ciclo mesmo com ramo unico', () => {
  assert.throws(() => validateLinearTokenBranches(['a1'], 'join', elements,
    [{ source_element_id: 'a1', target_element_id: 'a1' }], 'inclusive'), ConflictException)
})
test('2I: OR inicia tokens apenas para condicoes persistidas no servidor', async () => {
  const document: any = { id: 'd', account_id: 'acc', workflow_id: 'wf', current_element_id: 'fork', status: 'draft' }
  const gateway = { element_id: 'fork', element_kind: 'inclusiveGateway', config: { joinElementId: 'join', outcome: 'approved' } }
  const forks = [
    { source_element_id: 'fork', target_element_id: 'a1', outcome: 'approved' },
    { source_element_id: 'fork', target_element_id: 'b1', outcome: 'rejected' },
  ]
  const tokens: any[] = []
  const prisma: any = {
    document_relations: { findMany: async () => [] },
    workflow_elements: {
      findFirst: async ({ where }: any) => where.element_id === 'fork' ? gateway : elements.find(e => e.element_id === where.element_id),
      findMany: async () => [gateway, ...elements],
    },
    workflow_transitions: { findMany: async ({ where }: any) =>
      where.source_element_id ? [...forks, ...transitions].filter(f => f.source_element_id === where.source_element_id) : [...forks, ...transitions] },
    workflow_execution_tokens: {
      count: async () => tokens.length,
      create: async ({ data }: any) => { tokens.push(data); return data },
    },
    document_instances: {
      findFirst: async () => document,
      update: async ({ data }: any) => Object.assign(document, data),
    },
    $queryRaw: async () => [{ id: 'd' }],
    $transaction: async (fn: any) => fn(prisma),
  }
  const runtime = new WorkflowTokenRuntimeService(prisma, { document: async () => document } as any)
  const result = await runtime.start({ id: 'admin', accountId: 'acc', role: 'admin' }, 'd')
  assert.equal(result.active, 1)
  assert.deepEqual(tokens.map(t => t.branch_key), ['a1'])
  assert.equal(tokens[0].join_element_id, 'join')
  assert.equal(document.status, 'in_progress')
})
