import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WorkflowEventService } from '../src/workflow-automation/workflow-event.service'

test('3C: signal consulta tokens e elementos em lote e cria jobs em lote', async () => {
  const docs = [
    { id: 'doc1', workflow_id: 'wf1', current_element_id: 'wait' },
    { id: 'doc2', workflow_id: 'wf2', current_element_id: 'wait' },
  ]
  let findTokens = 0, findElements = 0, countTokens = 0, createJobs = 0, transactionOptions: any
  const inserted: any[] = []
  const tx: any = {
    workflow_events: {
      findUnique: async () => null,
      create: async () => ({ id: 'event-id' }),
    },
    document_instances: { findMany: async () => docs },
    workflow_execution_tokens: {
      findMany: async ({ where }: any) => {
        findTokens++
        assert.deepEqual(where.document_instance_id.in, ['doc1', 'doc2'])
        return []
      },
      count: async () => { countTokens++; return 0 },
    },
    workflow_elements: { findMany: async () => {
      findElements++
      return ['wf1', 'wf2'].map(workflow_id => ({
        workflow_id, element_id: 'wait', element_kind: 'receiveTask',
        config: { eventTrigger: { enabled: true, type: 'signal', name: 'qualidade.sinal' } },
      }))
    } },
    workflow_automation_jobs: { createMany: async ({ data }: any) => {
      createJobs++
      inserted.push(...data)
      return { count: data.length }
    } },
  }
  const prisma: any = { $transaction: async (callback: any, options: any) => {
    transactionOptions = options
    return callback(tx)
  } }
  const service = new WorkflowEventService(prisma, { assertAdmin: () => {} } as any, {} as any)
  const result = await service.publish({ id: 'admin', accountId: 'acc', role: 'admin' },
    { type: 'signal', name: 'qualidade.sinal', key: 'chaveunica123' })
  assert.equal(result.queued, 2)
  assert.equal(findTokens, 1)
  assert.equal(findElements, 1)
  assert.equal(countTokens, 0)
  assert.equal(createJobs, 1)
  assert.equal(inserted.length, 2)
  assert.equal(new Set(inserted.map(job => job.idempotency_key)).size, 2)
  assert.equal(transactionOptions.timeout, 20000)
})
