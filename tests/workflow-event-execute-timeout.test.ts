import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WorkflowEventService } from '../src/workflow-automation/workflow-event.service'

test('3C: transacao de entrega de evento usa timeout controlado sem alterar documento ausente', async () => {
  let options: Record<string, unknown> | undefined
  const prisma: any = {
    $transaction: async (callback: (tx: any) => Promise<any>, settings: Record<string, unknown>) => {
      options = settings
      return callback({
        $queryRaw: async () => [],
        document_instances: { findFirst: async () => null },
      })
    },
  }
  const service = new WorkflowEventService(prisma, {} as any, {} as any)
  const result = await service.execute({
    account_id: 'account', document_instance_id: '11111111-1111-4111-8111-111111111111',
    workflow_id: '22222222-2222-4222-8222-222222222222',
    element_id: 'receive-event', event_id: '33333333-3333-4333-8333-333333333333',
  })
  assert.equal(result, 'skipped')
  assert.equal(options?.timeout, 20000)
  assert.equal(options?.maxWait, 10000)
  assert.equal(options?.isolationLevel, 'Serializable')
})
