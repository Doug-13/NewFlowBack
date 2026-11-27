import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BadRequestException } from '@nestjs/common'
import { deadlineRules, planSchedules, timerSeconds } from '../src/workflow-automation/workflow-schedule-policy'
import { WorkflowScheduleService } from '../src/workflow-automation/workflow-schedule.service'

const entered = new Date('2026-11-27T00:00:00.000Z')

test('3B: timer inativo nao cria agendamento', () => {
  assert.deepEqual(planSchedules({element_kind:'intermediateCatchEvent',config:{timer:{enabled:false,delaySeconds:15}}}, entered),[])
})
test('3B: timer BPMN gera vencimento com atraso definido no servidor', () => {
  const el = { element_kind: 'intermediateCatchEvent', config:{timer:{enabled:true,delaySeconds:180}} }
  assert.equal(timerSeconds(el),180)
  assert.deepEqual(planSchedules(el,entered),[{kind:'timer',availableAt:new Date('2026-11-27T00:03:00.000Z')}])
})
test('3B: rejeita delay negativo e nao inteiro', () => {
  for (const delaySeconds of [-1, 1.1, '10', 2592001]) {
    assert.throws(()=>planSchedules({element_kind:'intermediateCatchEvent',config:{timer:{enabled:true,delaySeconds}}},entered),BadRequestException)
  }
})
test('3B: tarefa de usuario cria aviso no prazo da atividade', () => {
  const el = {element_kind:'userTask',config:{deadline:{enabled:true,minutes:60}}}
  assert.deepEqual(planSchedules(el,entered),[{kind:'deadline',availableAt:new Date('2026-11-27T01:00:00.000Z')}])
})
test('3B: escalonamento somente para destinatario configurado', () => {
  const el = {element_kind:'userTask',config:{deadline:{enabled:true,minutes:30,escalateAfterMinutes:15,escalateToUserId:'gestor'}}}
  assert.equal(deadlineRules(el)?.escalateToUserId,'gestor')
  assert.deepEqual(planSchedules(el,entered),[
    {kind:'deadline',availableAt:new Date('2026-11-27T00:30:00.000Z')},
    {kind:'escalation',availableAt:new Date('2026-11-27T00:45:00.000Z')},
  ])
})
test('3B: rejeita prazo inválido e data de referencia invalida', () => {
  assert.throws(()=>planSchedules({element_kind:'userTask',config:{deadline:{enabled:true,minutes:0}}},entered),BadRequestException)
  assert.throws(()=>planSchedules({element_kind:'userTask',config:{deadline:{enabled:true,minutes:1}}},'invalida'),BadRequestException)
})
test('3B: apenas notificacoes da conta e usuario autenticados', async () => {
  let filter: any
  const prisma: any = {workflow_notifications:{findMany:async (args:any)=>{filter=args.where;return []}}}
  const service = new WorkflowScheduleService(prisma,{} as any)
  assert.deepEqual(await service.notifications({id:'u2',accountId:'conta2'}),[])
  assert.deepEqual(filter,{account_id:'conta2',user_id:'u2'})
})
test('3B: marcacao de leitura nao permite acesso a outra conta ou usuario', async () => {
  let filter:any
  const prisma:any={workflow_notifications:{updateMany:async (args:any)=>{filter=args.where;return {count:0}}}}
  const service = new WorkflowScheduleService(prisma,{} as any)
  assert.deepEqual(await service.markRead({id:'u1',accountId:'a1'},'notificacao2'),{updated:0})
  assert.deepEqual(filter,{id:'notificacao2',account_id:'a1',user_id:'u1',is_read:false})
})
test('3B: timer com documento em outra etapa nao produz acao', async () => {
  const prisma: any = {
    $queryRaw:async()=>[{id:'doc'}],
    $transaction:async (fn:any)=>fn(prisma),
    document_instances:{findFirst:async()=>({id:'doc',workflow_id:'wf',account_id:'acc',current_element_id:'outra',status:'draft'})},
  }
  const service = new WorkflowScheduleService(prisma,{} as any)
  assert.equal(await service.execute({id:'job',account_id:'acc',document_instance_id:'doc',workflow_id:'wf',element_id:'timer',job_kind:'timer',idempotency_key:'key'}),'skipped')
})
test('3B: aviso obsoleto nao gera notificacao', async () => {
  const prisma:any={
    $queryRaw:async()=>[{id:'doc'}],$transaction:async(fn:any)=>fn(prisma),
    document_instances:{findFirst:async()=>({id:'doc',workflow_id:'wf',current_element_id:'outra',status:'in_progress'})},
  }
  const service = new WorkflowScheduleService(prisma,{} as any)
  assert.equal(await service.execute({id:'job',account_id:'acc',document_instance_id:'doc',workflow_id:'wf',element_id:'task',job_kind:'deadline',idempotency_key:'key'}),'skipped')
})

test('3B: worker descobre timer e prazo usando a fila persistente', async () => {
  const rows: any[] = []
  const prisma: any = {
    document_instances: { findMany: async () => [
      {id:'timer-doc',account_id:'acc',workflow_id:'wf',current_element_id:'timer',updated_at:entered},
      {id:'deadline-doc',account_id:'acc',workflow_id:'wf',current_element_id:'task',updated_at:entered},
    ] },
    workflow_execution_tokens: {count:async()=>0,findMany:async()=>[]},
    workflow_elements: { findFirst: async ({where}:any)=>where.element_id==='timer'
      ? {element_kind:'intermediateCatchEvent',config:{timer:{enabled:true,delaySeconds:30}}}
      : {element_kind:'userTask',config:{deadline:{enabled:true,minutes:15}}} },
    workflow_automation_jobs: {upsert:async({create}:any)=>{rows.push(create)}}
  }
  const { WorkflowAutomationQueueService } = await import('../src/workflow-automation/workflow-automation-queue.service')
  const worker = new WorkflowAutomationQueueService(prisma,{} as any,{} as any)
  assert.deepEqual(await worker.discover('acc'),{discovered:2})
  assert.deepEqual(rows.map(r=>r.job_kind).sort(),['deadline','timer'])
  assert.equal(rows.find(r=>r.job_kind==='timer').available_at.toISOString(),'2026-11-27T00:00:30.000Z')
})
