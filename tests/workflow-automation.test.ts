import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ConflictException } from '@nestjs/common'
import { WorkflowAutomationService } from '../src/workflow-automation/workflow-automation.service'

const user = { id: 'admin', role: 'admin', accountId: 'acc' }
function setup(kind = 'serviceTask', automation: any = { enabled: true, type: 'noop' }) {
  const doc: any = { id: 'doc', account_id: 'acc', workflow_id: 'wf', current_element_id: 'auto', status: 'draft' }
  const events: any[] = []
  const element = { element_id: 'auto', element_kind: kind, config: { automation }, name: 'Automatico', order_index: 1 }
  const target = { element_id: 'next', element_kind: 'userTask', name: 'Revisar', order_index: 2, is_end: false }
  const prisma: any = {
    $queryRaw: async () => [{ id: 'doc' }],
    $transaction: async (f: any) => f(prisma),
    document_instances: {
      findFirst: async () => doc,
      findMany: async () => [],
      updateMany: async ({ where, data }: any) => {
        if (where.current_element_id !== doc.current_element_id) return { count: 0 }
        Object.assign(doc, data)
        return { count: 1 }
      },
    },
    workflow_execution_tokens: { count: async () => 0 },
    document_relations: { findMany: async () => [] },
    workflow_elements: { findFirst: async ({ where }: any) => where.element_id === 'auto' ? element : target },
    workflow_transitions: { findMany: async () => [{ target_element_id: 'next' }] },
    document_action_history: { create: async ({ data }: any) => { events.push(data); return data } },
  }
  const access: any = {
    assertAdmin: (u: any) => { if (u.role !== 'admin') throw new Error('unauthorized') },
    document: async () => doc,
  }
  const parent: any = { resumeAfterChildFinished: async () => ({ resumed: 0 }) }
  return { service: new WorkflowAutomationService(prisma, access, parent), prisma, doc, events }
}

test('3A: noop avanca uma serviceTask e registra um unico historico', async () => {
  const { service, doc, events } = setup()
  const result = await service.execute(user, 'doc')
  assert.equal(result.executed, true)
  assert.equal(doc.current_element_id, 'next')
  assert.equal(events.length, 1)
  assert.equal(events[0].action_id, 'automation.noop')
})
test('3A: reexecucao nao duplica historico', async () => {
  const { service, events } = setup()
  await service.execute(user, 'doc')
  await assert.rejects(() => service.execute(user, 'doc'), ConflictException)
  assert.equal(events.length, 1)
})
test('3A: recusa elemento que nao seja serviceTask', async () => {
  const { service } = setup('userTask')
  await assert.rejects(() => service.execute(user, 'doc'), ConflictException)
})
test('3A: recusa automation desabilitada ou tipo inesperado', async () => {
  const { service } = setup('serviceTask', { enabled: true, type: 'javascript' })
  await assert.rejects(() => service.execute(user, 'doc'), ConflictException)
})
test('3A: recusa documento com tokens ativos', async () => {
  const { service, prisma } = setup()
  prisma.workflow_execution_tokens.count = async () => 1
  await assert.rejects(() => service.execute(user, 'doc'), ConflictException)
})
test('3A: recusa transicoes ambiguas', async () => {
  const { service, prisma } = setup()
  prisma.workflow_transitions.findMany = async () => [{ target_element_id: 'next' }, { target_element_id: 'other' }]
  await assert.rejects(() => service.execute(user, 'doc'), ConflictException)
})
test('3A: recusa subprocesso obrigatorio pendente', async () => {
  const { service, prisma } = setup()
  prisma.document_relations.findMany = async () => [{ child_document_instance_id: 'child' }]
  await assert.rejects(() => service.execute(user, 'doc'), ConflictException)
})
test('3A: nao permite usuario sem privilegio administrativo', async () => {
  const { service } = setup()
  await assert.rejects(() => service.execute({ ...user, role: 'user' }, 'doc'))
})
