import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ParentResumeService } from '../src/workflow-coordination/parent-resume.service'

function setup(options: { secondStatus?: string; current?: string; destination?: string; active?: number; waiting?: string | null } = {}) {
  const parent = { id: 'parent', account_id: 'account', status: 'in_progress',
    current_element_id: options.current ?? 'wait', workflow_id: 'wf' }
  const links = ['child1', 'child2'].map(id => ({ parent_document_instance_id: 'parent',
    child_document_instance_id: id, parent_waiting_element_id: options.waiting === undefined ? 'wait' : options.waiting,
    parent_next_element_id: options.destination ?? 'next', status: 'created' }))
  const state = { parent, links, history: 0, updates: 0 }
  const tx: any = {
    $queryRaw: async () => [{ id: 'parent' }],
    document_instances: {
      findFirst: async () => ({ ...state.parent }),
      findMany: async () => [{ id: 'child1', status: 'completed' }, { id: 'child2', status: options.secondStatus ?? 'completed' }],
      updateMany: async ({ where, data }: any) => {
        if (state.parent.current_element_id !== where.current_element_id) return { count: 0 }
        Object.assign(state.parent, data); state.updates++; return { count: 1 }
      },
    },
    document_relations: {
      findMany: async () => links,
      updateMany: async ({ data }: any) => { links.forEach(l => Object.assign(l, data)); return { count: links.length } },
    },
    workflow_execution_tokens: { count: async () => options.active ?? 0 },
    workflow_transitions: { findMany: async () => [{ target_element_id: 'next' }] },
    workflow_elements: { findFirst: async () => ({ element_id: 'next', name: 'Revisao', order_index: 4, is_end: false, element_kind: 'userTask' }) },
    document_action_history: { create: async () => { state.history++ } },
  }
  const prisma: any = { document_relations: { findMany: async () => [{ parent_document_instance_id: 'parent' }] },
    $transaction: async (fn: any) => fn(tx) }
  return { service: new ParentResumeService(prisma), state }
}

test('2J: retoma pai quando todos os filhos obrigatorios concluem', async () => {
  const { service, state } = setup()
  assert.deepEqual(await service.resumeAfterChildFinished('account', 'child2'), { resumed: 1 })
  assert.equal(state.parent.current_element_id, 'next')
  assert.equal(state.history, 1)
})
test('2J: filho pendente bloqueia retomada', async () => {
  const { service, state } = setup({ secondStatus: 'in_progress' })
  assert.deepEqual(await service.resumeAfterChildFinished('account', 'child1'), { resumed: 0 })
  assert.equal(state.updates, 0)
})
test('2J: sem rota de espera persistida nao avanca', async () => {
  const { service, state } = setup({ waiting: null })
  assert.deepEqual(await service.resumeAfterChildFinished('account', 'child2'), { resumed: 0 })
  assert.equal(state.history, 0)
})
test('2J: tokens ativos impedem retomada', async () => {
  const { service } = setup({ active: 1 })
  assert.deepEqual(await service.resumeAfterChildFinished('account', 'child2'), { resumed: 0 })
})
test('2J: retomada e idempotente e evita duplicar historico', async () => {
  const { service, state } = setup()
  await service.resumeAfterChildFinished('account', 'child2')
  assert.deepEqual(await service.resumeAfterChildFinished('account', 'child2'), { resumed: 0 })
  assert.equal(state.history, 1)
})
test('2J: pai fora do elemento de espera nao avanca', async () => {
  const { service } = setup({ current: 'other' })
  assert.deepEqual(await service.resumeAfterChildFinished('account', 'child2'), { resumed: 0 })
})
