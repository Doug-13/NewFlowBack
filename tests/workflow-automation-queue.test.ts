import { test } from 'node:test'
import assert from 'node:assert/strict'
import { automationJobKey, failureDisposition, isNoopAutomation, retryDelayMs } from '../src/workflow-automation/automation-job-policy'
import { WorkflowAutomationQueueService } from '../src/workflow-automation/workflow-automation-queue.service'

test('3A: chave idempotente separa documentos, tokens e atividades', () => {
  assert.equal(automationJobKey('doc','a'), 'doc:document:a')
  assert.equal(automationJobKey('doc','a','token'), 'doc:token:a')
  assert.notEqual(automationJobKey('doc','a','token'), automationJobKey('doc','b','token'))
})
test('3A: somente serviceTask noop habilitada executa automaticamente', () => {
  assert.equal(isNoopAutomation({ element_kind: 'serviceTask', config: {automation:{enabled:true,type:'noop'}}}), true)
  assert.equal(isNoopAutomation({ element_kind: 'userTask', config: {automation:{enabled:true,type:'noop'}}}), false)
  assert.equal(isNoopAutomation({ element_kind: 'serviceTask', config: {automation:{enabled:true,type:'javascript'}}}), false)
  assert.equal(isNoopAutomation({ element_kind: 'serviceTask', config: {automation:{enabled:false,type:'noop'}}}), false)
})
test('3A: retry exponencial com limite', () => {
  assert.equal(retryDelayMs(1), 5000)
  assert.equal(retryDelayMs(2), 10000)
  assert.equal(retryDelayMs(3), 20000)
  assert.equal(retryDelayMs(20), 300000)
})
test('3A: dead-letter so apos atingir o limite', () => {
  assert.equal(failureDisposition(1,5), 'retry')
  assert.equal(failureDisposition(4,5), 'retry')
  assert.equal(failureDisposition(5,5), 'dead')
})
test('3A: worker desabilitado por padrao nao inicia timer', () => {
  const queue = new WorkflowAutomationQueueService({} as any, {} as any, {} as any)
  const current = process.env.NEWFLOW_AUTOMATION_WORKER_ENABLED
  delete process.env.NEWFLOW_AUTOMATION_WORKER_ENABLED
  try { queue.onModuleInit(); queue.onModuleDestroy() } finally {
    if (current !== undefined) process.env.NEWFLOW_AUTOMATION_WORKER_ENABLED = current
  }
})
test('3A: descoberta ignora documents com tokens e registra token noop', async () => {
  const records: any[] = []
  const prisma: any = {
    document_instances: {
      findMany: async () => [{id:'doc',account_id:'acc',workflow_id:'wf',current_element_id:'s1'}],
      findFirst: async () => ({workflow_id:'wf'}),
    },
    workflow_execution_tokens: {
      count: async () => 1,
      findMany: async () => [{id:'token',account_id:'acc',document_instance_id:'doc',element_id:'s1'}],
    },
    workflow_elements: { findFirst: async () => ({element_kind:'serviceTask',config:{automation:{enabled:true,type:'noop'}}}) },
    workflow_automation_jobs: { upsert: async ({create}:any) => records.push(create) },
  }
  const queue = new WorkflowAutomationQueueService(prisma, {} as any, {} as any)
  const result = await queue.discover('acc')
  assert.equal(result.discovered, 1)
  assert.equal(records.length, 1)
  assert.equal(records[0].token_id, 'token')
})
test('3A: fila sem jobs nao executa nenhuma tarefa', async () => {
  const queue = new WorkflowAutomationQueueService({ $queryRaw: async () => [] } as any, {} as any, {} as any)
  const result = await queue.process(10, 'acc')
  assert.equal(result.processed, 0)
})
test('3A: job concluido escreve status persistente', async () => {
  const statuses: string[] = []
  let first = true
  const prisma: any = {
    $queryRaw: async () => first ? [{id:'job'}] : [],
    workflow_automation_jobs: {
      findUnique: async () => { first = false; return {id:'job',account_id:'acc',document_instance_id:'doc',workflow_id:'wf',element_id:'step',token_id:null,attempt_count:1,max_attempts:5} },
      updateMany: async ({data}:any) => { statuses.push(data.status); return {count:1} },
    },
    document_instances: { findFirst: async () => ({id:'doc',workflow_id:'wf',current_element_id:'step',status:'draft'}) },
  }
  const queue = new WorkflowAutomationQueueService(prisma, {execute:async () => ({executed:true})} as any, {} as any)
  const result = await queue.process(1,'acc')
  assert.equal(result.completed,1)
  assert.deepEqual(statuses,['completed'])
})
test('3A: falha persiste retry em vez de perder o job', async () => {
  const statuses: string[] = []
  let first = true
  const prisma: any = {
    $queryRaw: async () => first ? [{id:'job'}] : [],
    workflow_automation_jobs: {
      findUnique: async () => { first = false; return {id:'job',account_id:'acc',document_instance_id:'doc',workflow_id:'wf',element_id:'step',token_id:null,attempt_count:1,max_attempts:5} },
      updateMany: async ({data}:any) => { statuses.push(data.status); return {count:1} },
    },
    document_instances: { findFirst: async () => ({id:'doc',workflow_id:'wf',current_element_id:'step',status:'draft'}) },
  }
  const queue = new WorkflowAutomationQueueService(prisma, {execute:async () => {throw new Error('simulado')}} as any, {} as any)
  const result = await queue.process(1,'acc')
  assert.equal(result.retried,1)
  assert.deepEqual(statuses,['retry'])
})
