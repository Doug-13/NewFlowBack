import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../src/prisma/prisma.service'
import { ParentResumeService } from '../../src/workflow-coordination/parent-resume.service'
import { ResourceAccessService } from '../../src/security/resource-access.service'
import { WorkflowAutomationService } from '../../src/workflow-automation/workflow-automation.service'
import { WorkflowAutomationQueueService } from '../../src/workflow-automation/workflow-automation-queue.service'
import { WorkflowScheduleService } from '../../src/workflow-automation/workflow-schedule.service'
import { WorkflowTokenRuntimeService } from '../../src/workflow-runtime/workflow-token-runtime.service'

/** Integration test, NEVER run automatically. All fixtures belong to a random account. */
const suffix = randomUUID().replace(/-/g, '').slice(0, 16)
const accountId = `BPMN3B_${suffix}`
let db: PrismaService | null = null
let created = false
const workflowIds: string[] = []
let ownerId = ''
let managerId = ''
type Doc = { id: string; workflowId: string }
const documents: Doc[] = []

function preflight() {
  assert.equal(process.env.BPMN_3B_CONFIRM, 'HOMOLOGAR3B', 'Confirmacao ausente.')
  assert.notEqual(process.env.NEWFLOW_AUTOMATION_WORKER_ENABLED, 'true', 'Desligue o worker.')
  const url = new URL(process.env.DATABASE_URL ?? '')
  assert.ok(url.hostname.endsWith('.neon.tech'), 'Somente Neon de testes.')
  assert.equal(url.hostname.toLowerCase(), process.env.BPMN_3B_EXPECTED_HOST?.toLowerCase(), 'Hostname diferente.')
  assert.equal(url.pathname.replace(/^\//, ''), 'neondb', 'Banco inesperado.')
  console.log(`Destino: ${url.hostname}/neondb; conta exclusiva: ${accountId}`)
}

async function fixture(label: string, kind: 'timer' | 'task', options: { bad?: boolean } = {}): Promise<Doc> {
  const process = await db!.processes.create({ data: {
    account_id: accountId, name: `Homologacao 3B ${label}`, code: `3B_${suffix}_${label}`,
  } })
  const workflowId = randomUUID()
  await db!.workflows.create({ data: {
    id: workflowId, public_id: randomUUID(), account_id: accountId,
    process_id: process.id, name: `Homologacao 3B ${label}`, status: 'published',
  } })
  workflowIds.push(workflowId)
  const config = kind === 'timer'
    ? { timer: { enabled: true, delaySeconds: 120 } }
    : { deadline: { enabled: true, minutes: 30, escalateAfterMinutes: 10, escalateToUserId: managerId } }
  const elementKind = kind === 'timer' ? 'intermediateCatchEvent' : 'userTask'
  for (const [i, node] of [
    { id: 'step', type: elementKind, config },
    { id: 'end', type: 'endEvent', config: {} },
  ].entries()) {
    await db!.workflow_elements.create({ data: {
      workflow_id: workflowId, account_id: accountId,
      element_id: node.id, element_kind: node.type, element_type: node.type,
      config: node.config, name: `${label} ${node.id}`, order_index: i,
      is_end: node.id === 'end',
    } })
  }
  if (!options.bad) await db!.workflow_transitions.create({ data: {
    workflow_id: workflowId, account_id: accountId,
    sequence_flow_id: `${suffix}_${label}_to_end`, source_element_id: 'step', target_element_id: 'end',
  } })
  const base = await db!.documents.create({ data: {
    account_id: accountId, process_id: process.id, workflow_id: workflowId,
    title: `Homologacao ${label}`, code: `3B-${suffix}-${label}`,
    created_by_id: ownerId, created_by_name: 'Owner Test',
  } })
  const instance = await db!.document_instances.create({ data: {
    account_id: accountId, process_id: process.id, workflow_id: workflowId,
    document_id: base.id, title: `Homologacao ${label}`, code: `3B-${suffix}-${label}`,
    current_element_id: 'step', current_step_name: 'step', status: 'in_progress',
    current_assigned_user_id: ownerId, current_assigned_user_name: 'Owner Test',
    created_by_id: ownerId, created_by_name: 'Owner Test',
  } })
  await db!.documents.update({ where: { id: base.id }, data: { current_instance_id: instance.id } })
  documents.push({ id: instance.id, workflowId })
  return { id: instance.id, workflowId }
}

function services() {
  const access = new ResourceAccessService(db!)
  const parent = new ParentResumeService(db!)
  const runtime = new WorkflowTokenRuntimeService(db!, access, parent)
  const automation = new WorkflowAutomationService(db!, access, parent, runtime)
  const schedule = new WorkflowScheduleService(db!, parent)
  const queue = new WorkflowAutomationQueueService(db!, automation, parent, schedule)
  return { queue, schedule }
}

async function job(doc: Doc, kind: string) {
  const result = await db!.workflow_automation_jobs.findFirst({ where: {
    account_id: accountId, document_instance_id: doc.id, job_kind: kind,
  } })
  assert.ok(result, `Job nao encontrado para ${doc.id} / ${kind}`)
  return result
}

/** Isolate one specific job; clock offset never affects eligibility. */
async function activate(targetId: string) {
  await db!.workflow_automation_jobs.updateMany({ where: {
    account_id: accountId, status: { in: ['queued', 'retry'] }, id: { not: targetId },
  }, data: { available_at: new Date(Date.now() + 86400000) } })
  await db!.workflow_automation_jobs.update({ where: { id: targetId }, data: { available_at: new Date(0) } })
}

async function run() {
  await db!.accounts.create({ data: { id: accountId, name: `Homologacao 3B ${suffix}` } })
  created = true
  const owner = await db!.users.create({ data: {
    account_id: accountId, name: 'Owner Test', email: `nf3b-owner-${suffix}@example.invalid`,
    password_hash: 'NOT_A_REAL_PASSWORD', role: 'user', is_active: true,
  } })
  const manager = await db!.users.create({ data: {
    account_id: accountId, name: 'Manager Test', email: `nf3b-manager-${suffix}@example.invalid`,
    password_hash: 'NOT_A_REAL_PASSWORD', role: 'user', is_active: true,
  } })
  ownerId = owner.id
  managerId = manager.id
  const timer = await fixture('timer', 'timer')
  const task = await fixture('deadline', 'task')
  const stale = await fixture('stale', 'timer')
  const retry = await fixture('retry', 'timer', { bad: true })
  let { queue, schedule } = services()

  console.log('1/8 Descoberta e idempotencia da fila')
  await queue.discover(accountId)
  assert.equal(await db!.workflow_automation_jobs.count({ where: { account_id: accountId } }), 5)
  await queue.discover(accountId)
  assert.equal(await db!.workflow_automation_jobs.count({ where: { account_id: accountId } }), 5)
  const timed = await job(timer, 'timer')
  assert.ok(timed.available_at instanceof Date)
  assert.equal(timed.status, 'queued')

  console.log('2/8 Timer avanca documento e grava historico')
  await activate(timed.id)
  assert.equal((await queue.process(1, accountId)).completed, 1)
  assert.equal((await db!.document_instances.findUniqueOrThrow({ where: { id: timer.id } })).status, 'completed')
  assert.equal(await db!.document_action_history.count({ where: {
    document_instance_id: timer.id, action_id: 'timer.fired',
  } }), 1)

  console.log('3/8 Vencimento notifica somente o responsavel')
  const deadline = await job(task, 'deadline')
  await activate(deadline.id)
  assert.equal((await queue.process(1, accountId)).completed, 1)
  const ownerNotices = await schedule.notifications({ id: ownerId, accountId })
  assert.equal(ownerNotices.length, 1)
  assert.equal(ownerNotices[0].kind, 'deadline')
  assert.equal((await schedule.notifications({ id: managerId, accountId })).length, 0)

  console.log('4/8 Escalonamento notifica o gestor uma vez')
  const escalation = await job(task, 'escalation')
  await activate(escalation.id)
  assert.equal((await queue.process(1, accountId)).completed, 1)
  const managerNotices = await schedule.notifications({ id: managerId, accountId })
  assert.equal(managerNotices.length, 1)
  assert.equal(managerNotices[0].kind, 'escalation')
  assert.equal(await db!.workflow_notifications.count({ where: { account_id: accountId } }), 2)

  console.log('5/8 Leitura protegida: usuario alheio nao marca notificacao')
  assert.deepEqual(await schedule.markRead({ id: managerId, accountId }, ownerNotices[0].id), { updated: 0 })
  assert.deepEqual(await schedule.markRead({ id: ownerId, accountId }, ownerNotices[0].id), { updated: 1 })
  assert.deepEqual(await schedule.markRead({ id: ownerId, accountId }, ownerNotices[0].id), { updated: 0 })
  assert.equal((await schedule.notifications({ id: ownerId, accountId }))[0].is_read, true)

  console.log('6/8 Timer obsoleto nao altera documento nem historico')
  const staleJob = await job(stale, 'timer')
  await db!.document_instances.update({ where: { id: stale.id }, data: {
    current_element_id: 'end', status: 'completed',
  } })
  await activate(staleJob.id)
  assert.equal((await queue.process(1, accountId)).skipped, 1)
  assert.equal(await db!.document_action_history.count({ where: {
    document_instance_id: stale.id, action_id: 'timer.fired',
  } }), 0)

  console.log('7/8 Falha de grafo: retry persistido, reparo e sucesso')
  const retryJob = await job(retry, 'timer')
  await activate(retryJob.id)
  assert.equal((await queue.process(1, accountId)).retried, 1)
  assert.equal((await job(retry, 'timer')).status, 'retry')
  await db!.workflow_transitions.create({ data: {
    workflow_id: retry.workflowId, account_id: accountId,
    sequence_flow_id: `${suffix}_retry_fixed`, source_element_id: 'step', target_element_id: 'end',
  } })
  await activate(retryJob.id)
  assert.equal((await queue.process(1, accountId)).completed, 1)
  assert.equal(await db!.document_action_history.count({ where: {
    document_instance_id: retry.id, action_id: 'timer.fired',
  } }), 1)

  console.log('8/8 Reconexao confirma persistencia e ausencia de duplicatas')
  await db!.$disconnect()
  db = new PrismaService()
  await db.$connect()
  ;({ queue, schedule } = services())
  await queue.discover(accountId)
  assert.equal(await db!.workflow_automation_jobs.count({ where: { account_id: accountId } }), 5)
  assert.equal(await db!.workflow_notifications.count({ where: { account_id: accountId } }), 2)
  assert.equal((await queue.process(5, accountId)).processed, 0)
  assert.equal((await schedule.notifications({ id: ownerId, accountId }))[0].is_read, true)
  console.log('HOMOLOGACAO 3B: TODOS OS 8 CENARIOS APROVADOS')
}

async function cleanup() {
  if (!db || !created) return
  const rows = await db.document_instances.findMany({ where: { account_id: accountId }, select: { id: true } })
  const ids = rows.map(x => x.id)
  // Never delete or update data outside this temporary account or its document ids.
  await db.workflow_notifications.deleteMany({ where: { account_id: accountId } })
  await db.workflow_automation_jobs.deleteMany({ where: { account_id: accountId } })
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
    console.error('HOMOLOGACAO 3B FALHOU:', error)
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
