import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../src/prisma/prisma.service'
import { ParentResumeService } from '../../src/workflow-coordination/parent-resume.service'
import { ResourceAccessService } from '../../src/security/resource-access.service'
import { WorkflowAutomationService } from '../../src/workflow-automation/workflow-automation.service'
import { WorkflowAutomationQueueService } from '../../src/workflow-automation/workflow-automation-queue.service'
import { WorkflowScheduleService } from '../../src/workflow-automation/workflow-schedule.service'
import { WorkflowEventService } from '../../src/workflow-automation/workflow-event.service'
import { WorkflowTokenRuntimeService } from '../../src/workflow-runtime/workflow-token-runtime.service'

// Teste isolado; nunca executado pela suite de testes normal.
const suffix = randomUUID().replace(/-/g, '').slice(0, 16)
const accountId = `BPMN3C_${suffix}`
let db: PrismaService | null = null
let accountCreated = false
const workflowIds: string[] = []
type Doc = { id: string; workflowId: string }
const user = { id: '3c-admin', accountId, role: 'admin' }
const other = { id: '3c-admin-outro', accountId: `BPMN3C_OUTRO_${suffix}`, role: 'admin' }

function preflight() {
  assert.equal(process.env.BPMN_3C_CONFIRM, 'HOMOLOGAR3C', 'Confirmacao ausente.')
  assert.notEqual(process.env.NEWFLOW_AUTOMATION_WORKER_ENABLED, 'true', 'Worker deve estar desativado.')
  const url = new URL(process.env.DATABASE_URL ?? '')
  assert.ok(url.hostname.endsWith('.neon.tech'), 'Somente Neon de testes.')
  assert.equal(url.hostname.toLowerCase(), process.env.BPMN_3C_EXPECTED_HOST?.toLowerCase(), 'Hostname diferente.')
  assert.equal(url.pathname.replace(/^\//, ''), 'neondb', 'Nome do banco diferente.')
  console.log(`Destino: ${url.hostname}/neondb; conta temporaria: ${accountId}`)
}

async function fixture(label: string, type: 'message' | 'signal', name: string, bad = false): Promise<Doc> {
  const process = await db!.processes.create({ data: {
    account_id: accountId, name: `Homologacao 3C ${label}`, code: `3C_${suffix}_${label}`,
  } })
  const workflowId = randomUUID()
  await db!.workflows.create({ data: {
    id: workflowId, public_id: randomUUID(), account_id: accountId,
    process_id: process.id, name: `Homologacao 3C ${label}`, status: 'published',
  } })
  workflowIds.push(workflowId)
  for (const [index, node] of [
    { id: 'wait', kind: type === 'message' ? 'receiveTask' : 'intermediateCatchEvent',
      config: { eventTrigger: { enabled: true, type, name } } },
    { id: 'end', kind: 'endEvent', config: {} },
  ].entries()) {
    await db!.workflow_elements.create({ data: {
      workflow_id: workflowId, account_id: accountId, element_id: node.id,
      element_type: node.kind, element_kind: node.kind, name: `${label} ${node.id}`,
      order_index: index, config: node.config, is_end: node.id === 'end',
    } })
  }
  if (!bad) await db!.workflow_transitions.create({ data: {
    workflow_id: workflowId, account_id: accountId,
    sequence_flow_id: `${suffix}_${label}_finish`, source_element_id: 'wait', target_element_id: 'end',
  } })
  const base = await db!.documents.create({ data: {
    account_id: accountId, process_id: process.id, workflow_id: workflowId,
    title: `3C ${label}`, code: `3C-${suffix}-${label}`, created_by_id: user.id,
  } })
  const instance = await db!.document_instances.create({ data: {
    account_id: accountId, process_id: process.id, workflow_id: workflowId,
    document_id: base.id, title: `3C ${label}`, code: `3C-${suffix}-${label}`,
    current_element_id: 'wait', current_step_name: 'wait', status: 'in_progress',
    created_by_id: user.id,
  } })
  await db!.documents.update({ where: { id: base.id }, data: { current_instance_id: instance.id } })
  return { id: instance.id, workflowId }
}

function services() {
  const access = new ResourceAccessService(db!)
  const parent = new ParentResumeService(db!)
  const runtime = new WorkflowTokenRuntimeService(db!, access, parent)
  const automation = new WorkflowAutomationService(db!, access, parent, runtime)
  const schedule = new WorkflowScheduleService(db!, parent)
  const events = new WorkflowEventService(db!, access, parent)
  const queue = new WorkflowAutomationQueueService(db!, automation, parent, schedule, events)
  return { queue, events }
}

async function eventJob(doc: Doc) {
  const job = await db!.workflow_automation_jobs.findFirst({ where: {
    account_id: accountId, document_instance_id: doc.id, job_kind: 'event',
  }, orderBy: { created_at: 'desc' } })
  assert.ok(job, `Job nao encontrado: ${doc.id}`)
  return job
}
async function activate(id: string) {
  await db!.workflow_automation_jobs.updateMany({ where: {
    account_id: accountId, status: { in: ['queued', 'retry'] }, id: { not: id },
  }, data: { available_at: new Date(Date.now() + 86400000) } })
  await db!.workflow_automation_jobs.update({ where: { id }, data: { available_at: new Date(0) } })
}
async function eventHistory(doc: Doc) {
  return db!.document_action_history.count({ where: { document_instance_id: doc.id, action_id: { startsWith: 'event.' } } })
}

async function run() {
  await db!.accounts.create({ data: { id: accountId, name: `Homologacao 3C ${suffix}` } })
  accountCreated = true
  const messageDoc = await fixture('message', 'message', 'plano.acao')
  const signalA = await fixture('signalA', 'signal', 'liberacao.geral')
  const signalB = await fixture('signalB', 'signal', 'liberacao.geral')
  const unrelated = await fixture('unrelated', 'message', 'outro.evento')
  const stale = await fixture('stale', 'message', 'plano.acao')
  const retry = await fixture('retry', 'message', 'plano.acao', true)
  let { queue, events } = services()

  console.log('1/8 Mensagem direcionada, idempotencia e conflito de chave')
  const keyMessage = `msg_${suffix}`
  const body = { type: 'message', name: 'plano.acao', key: keyMessage, documentId: messageDoc.id } as const
  const first = await events.publish(user, body)
  assert.equal(first.duplicate, false)
  assert.equal(first.queued, 1)
  const repeated = await events.publish(user, body)
  assert.equal(repeated.duplicate, true)
  assert.equal(repeated.eventId, first.eventId)
  assert.equal(repeated.queued, 1)
  await assert.rejects(() => events.publish(user, { ...body, name: 'outro.evento' }))
  assert.equal(await db!.workflow_automation_jobs.count({ where: { account_id: accountId, event_id: first.eventId } }), 1)

  console.log('2/8 Worker processa mensagem e registra historico uma unica vez')
  const normal = await eventJob(messageDoc)
  await activate(normal.id)
  assert.equal((await queue.process(1, accountId)).completed, 1)
  assert.equal((await db!.document_instances.findUniqueOrThrow({ where: { id: messageDoc.id } })).status, 'completed')
  assert.equal(await eventHistory(messageDoc), 1)

  console.log('3/8 Signal envia apenas aos documentos compativeis da mesma conta')
  const signalEvent = await events.publish(user, { type: 'signal', name: 'liberacao.geral', key: `sig_${suffix}` })
  assert.equal(signalEvent.queued, 2)
  assert.equal(await db!.workflow_automation_jobs.count({ where: { event_id: signalEvent.eventId, account_id: accountId } }), 2)
  assert.equal(await eventHistory(unrelated), 0)

  console.log('4/8 Worker entrega signal a dois processos, sem duplicidade')
  for (const doc of [signalA, signalB]) {
    const job = await eventJob(doc)
    await activate(job.id)
    assert.equal((await queue.process(1, accountId)).completed, 1)
    assert.equal(await eventHistory(doc), 1)
    assert.equal((await db!.document_instances.findUniqueOrThrow({ where: { id: doc.id } })).status, 'completed')
  }
  assert.equal(await eventHistory(unrelated), 0)

  console.log('5/8 Isolamento entre contas e operacoes reservadas ao administrador')
  await assert.rejects(() => events.publish(other, { type: 'message', name: 'plano.acao', key: `other_${suffix}`, documentId: stale.id }))
  await assert.rejects(() => events.publish({ ...user, role: 'user' }, { type: 'message', name: 'plano.acao', key: `user_${suffix}`, documentId: stale.id }))
  assert.equal((await events.list(user)).length, 2)
  assert.equal((await events.list(other)).length, 0)
  assert.equal(await db!.workflow_events.count({ where: { account_id: accountId } }), 2)

  console.log('6/8 Mensagem obsoleta nao altera documento ou historico')
  await events.publish(user, { type: 'message', name: 'plano.acao', key: `stale_${suffix}`, documentId: stale.id })
  const staleJob = await eventJob(stale)
  await db!.document_instances.update({ where: { id: stale.id }, data: { current_element_id: 'end', status: 'completed' } })
  await activate(staleJob.id)
  assert.equal((await queue.process(1, accountId)).skipped, 1)
  assert.equal(await eventHistory(stale), 0)

  console.log('7/8 Falha do grafo gera retry; reparo permite concluir')
  await events.publish(user, { type: 'message', name: 'plano.acao', key: `retry_${suffix}`, documentId: retry.id })
  const retryJob = await eventJob(retry)
  await activate(retryJob.id)
  assert.equal((await queue.process(1, accountId)).retried, 1)
  assert.equal((await eventJob(retry)).status, 'retry')
  await db!.workflow_transitions.create({ data: {
    workflow_id: retry.workflowId, account_id: accountId,
    sequence_flow_id: `${suffix}_retry_repaired`, source_element_id: 'wait', target_element_id: 'end',
  } })
  await activate(retryJob.id)
  assert.equal((await queue.process(1, accountId)).completed, 1)
  assert.equal(await eventHistory(retry), 1)

  console.log('8/8 Reconexao valida persistencia e idempotencia')
  const jobs = await db!.workflow_automation_jobs.count({ where: { account_id: accountId } })
  assert.equal(jobs, 5)
  await db!.$disconnect()
  db = new PrismaService()
  await db.$connect()
  ;({ queue, events } = services())
  assert.equal(await db!.workflow_automation_jobs.count({ where: { account_id: accountId } }), jobs)
  assert.equal((await events.publish(user, body)).duplicate, true)
  assert.equal((await queue.process(10, accountId)).processed, 0)
  assert.equal(await db!.workflow_events.count({ where: { account_id: accountId } }), 4)
  assert.equal(await eventHistory(messageDoc), 1)
  assert.equal(await eventHistory(signalA), 1)
  assert.equal(await eventHistory(signalB), 1)
  assert.equal(await eventHistory(retry), 1)
  console.log('HOMOLOGACAO 3C: TODOS OS 8 CENARIOS APROVADOS')
}

async function cleanup() {
  if (!db || !accountCreated) return
  const docs = await db.document_instances.findMany({ where: { account_id: accountId }, select: { id: true } })
  const ids = docs.map(d => d.id)
  await db.workflow_automation_jobs.deleteMany({ where: { account_id: accountId } })
  await db.workflow_events.deleteMany({ where: { account_id: accountId } })
  await db.workflow_notifications.deleteMany({ where: { account_id: accountId } })
  await db.workflow_execution_tokens.deleteMany({ where: { account_id: accountId } })
  await db.document_action_history.deleteMany({ where: { document_instance_id: { in: ids } } })
  await db.audit_logs.deleteMany({ where: { document_instance_id: { in: ids } } })
  await db.document_relations.deleteMany({ where: { account_id: accountId } })
  await db.documents.updateMany({ where: { account_id: accountId }, data: { current_instance_id: null } })
  await db.document_instances.deleteMany({ where: { account_id: accountId } })
  await db.documents.deleteMany({ where: { account_id: accountId } })
  await db.workflow_activity_actions.deleteMany({ where: { workflow_id: { in: workflowIds } } })
  await db.workflow_transitions.deleteMany({ where: { account_id: accountId } })
  await db.workflow_elements.deleteMany({ where: { account_id: accountId } })
  await db.workflows.deleteMany({ where: { account_id: accountId } })
  await db.processes.deleteMany({ where: { account_id: accountId } })
  await db.users.deleteMany({ where: { account_id: accountId } })
  await db.accounts.deleteMany({ where: { id: accountId } })
  console.log(`Dados temporarios ${accountId} removidos.`)
}

async function main() {
  preflight()
  let failure: unknown = null
  try {
    db = new PrismaService()
    await db.$connect()
    await run()
  } catch (error) {
    failure = error
    console.error('HOMOLOGACAO 3C FALHOU:', error)
  } finally {
    if (db) {
      try { await cleanup() } catch (error) {
        console.error(`LIMPEZA INCOMPLETA: investigar somente ${accountId}`, error)
        if (!failure) failure = error
      }
      await db.$disconnect()
    }
  }
  if (failure) process.exitCode = 1
}
void main()
