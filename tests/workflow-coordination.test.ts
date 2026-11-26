import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { BadRequestException, ConflictException } from '@nestjs/common'
import { deadlineState, WorkflowCoordinationService } from '../src/workflow-coordination/workflow-coordination.service'

const user = { id: 'u1', accountId: 'a1', role: 'user', name: 'Teste' }
const parent = { id: 'p1', document_id: 'bp', process_id: 'proc1', status: 'in_progress' }
const child = { id: 'c1', document_id: 'bc', process_id: 'proc2', workflow_id: 'w2', status: 'draft' }
function setup() {
  const relations: any[] = []
  const prisma: any = {
    document_relations: {
      findFirst: async ({ where }: any) => relations.find(r => r.parent_document_instance_id === where.parent_document_instance_id && r.child_document_instance_id === where.child_document_instance_id) ?? null,
      findMany: async () => relations,
      create: async ({ data }: any) => { const record = { id: 'r' + (relations.length + 1), ...data }; relations.push(record); return record },
      updateMany: async ({ where, data }: any) => { const rows = relations.filter(r => r.id === where.id && r.status !== 'completed'); rows.forEach(r => Object.assign(r, data)); return { count: rows.length } },
      count: async () => relations.filter(r => r.wait_for_completion && r.status !== 'completed').length,
    },
    document_instances: { findFirst: async ({ where }: any) => where.id === 'c1' && where.account_id === 'a1' ? { status: 'completed' } : null,
      findMany: async () => [{ id: 'p1', title: 'Pai', code: 'P1', process_id: 'proc1', due_date: new Date('2026-01-01'), current_assigned_user_id: 'u1', created_by_id: 'u1' }] },
  }
  const access: any = { document: async (u: any, id: string) => {
    if (u.accountId !== 'a1') throw new Error('denied')
    return id === 'p1' ? parent : child
  }, process: async () => ({ id: 'proc2', name: 'Teste' }), workflow: async () => ({ id: 'w2', process_id: 'proc2', name: 'Fluxo' }),
    availableProcessIds: async () => ['proc1'] }
  const documents: any = { create: async () => ({ id: 'c1', code: 'C1', title: 'Filho' }) }
  return { service: new WorkflowCoordinationService(prisma, access, documents), prisma, access, relations }
}

test('2D: recusa vínculo do documento consigo mesmo', async () => {
  const { service, access } = setup()
  access.document = async () => parent
  await assert.rejects(() => service.linkExisting(user, 'p1', { childDocumentInstanceId: 'p1' }), BadRequestException)
})
test('2D: vínculo repetido reutiliza relação existente', async () => {
  const { service, relations } = setup()
  assert.equal((await service.linkExisting(user, 'p1', { childDocumentInstanceId: 'c1' })).alreadyLinked, false)
  assert.equal((await service.linkExisting(user, 'p1', { childDocumentInstanceId: 'c1' })).alreadyLinked, true)
  assert.equal(relations.length, 1)
})
test('2D: sincroniza somente a relação aguardada e não avança processo pai', async () => {
  const { service } = setup()
  await service.linkExisting(user, 'p1', { childDocumentInstanceId: 'c1', waitForCompletion: true })
  const status = await service.synchronize(user, 'p1')
  assert.equal(status.readyToContinue, true)
  assert.equal(status.parentAdvanced, false)
  assert.equal(status.updated, 1)
})
test('2D: processo pai encerrado não recebe novos vínculos', async () => {
  const { service, access } = setup()
  access.document = async (_u: any, id: string) => id === 'p1' ? { ...parent, status: 'completed' } : child
  await assert.rejects(() => service.linkExisting(user, 'p1', { childDocumentInstanceId: 'c1' }), ConflictException)
})
test('2D: rejeita payload de subprocesso incompleto', async () => {
  const { service } = setup()
  await assert.rejects(() => service.startChild(user, 'p1', { title: 'Filho' }), BadRequestException)
})
test('2D: cria filho no processo aprovado e registra vínculo', async () => {
  const { service, relations } = setup()
  const result = await service.startChild(user, 'p1', { processId: 'proc2', workflowId: 'w2', title: 'Filho' })
  assert.equal(result.document.id, 'c1')
  assert.equal(relations.length, 1)
})
test('2E: identifica prazo vencido e prazo futuro', () => {
  const now = new Date('2026-11-25T12:00:00Z')
  assert.equal(deadlineState('2026-11-24T12:00:00Z', now).overdue, true)
  assert.equal(deadlineState('2026-11-27T12:00:00Z', now).daysRemaining, 2)
  assert.equal(deadlineState(null, now).daysRemaining, null)
})
test('2E: consulta vencimentos somente dos documentos acessíveis', async () => {
  const { service } = setup()
  const data = await service.deadlines(user)
  assert.equal(data.length, 1)
  assert.equal(data[0].documentInstanceId, 'p1')
})
