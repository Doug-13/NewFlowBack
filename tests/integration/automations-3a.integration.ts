import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../src/prisma/prisma.service'
import { ResourceAccessService } from '../../src/security/resource-access.service'
import { ParentResumeService } from '../../src/workflow-coordination/parent-resume.service'
import { WorkflowTokenRuntimeService } from '../../src/workflow-runtime/workflow-token-runtime.service'
import { WorkflowAutomationService } from '../../src/workflow-automation/workflow-automation.service'
import { WorkflowAutomationQueueService } from '../../src/workflow-automation/workflow-automation-queue.service'

/**
 * Real Neon/PostgreSQL phase 3A integration, opt-in only.
 * Creates and cleans a unique BPMN3A_* account, without touching existing accounts.
 * No arbitrary JS, HTTP calls, or user data copied into this fixture.
 */
const suffix = randomUUID().replace(/-/g, '').slice(0, 16)
const accountId = `BPMN3A_${suffix}`
const actor = { id: 'system', name: 'Homologacao BPMN3A', role: 'admin', accountId }
let db: PrismaService | null = null
let accountCreated = false

type TestDoc = { id: string; workflowId: string; processId: string }
const documents: TestDoc[] = []
const workflowIds: string[] = []

function preflight() {
  assert.equal(process.env.BPMN_3A_CONFIRM, 'HOMOLOGAR', 'Confirme BPMN_3A_CONFIRM=HOMOLOGAR no runner.')
  assert.notEqual(process.env.NEWFLOW_AUTOMATION_WORKER_ENABLED, 'true', 'O worker deve ficar DESATIVADO durante o teste.')
  const raw = process.env.DATABASE_URL
  assert.ok(raw, 'DATABASE_URL ausente no .env.')
  const url = new URL(raw)
  assert.ok(/(^|\.)neon\.tech$/.test(url.hostname), 'Teste permitido somente no Neon.')
  assert.equal(url.hostname.toLowerCase(), process.env.BPMN_3A_EXPECTED_HOST?.toLowerCase(), 'Hostname diferente do confirmado.')
  assert.equal(url.pathname.replace(/^\//, ''), 'neondb', 'Banco inesperado: esperado neondb de homologacao.')
  console.log(`Destino: ${url.hostname}/${url.pathname.slice(1)}`)
  console.log(`Conta temporaria: ${accountId}`)
}

async function newWorkflow(label: string, kind: 'simple' | 'and' = 'simple') {
  const process = await db!.processes.create({ data: {
    account_id: accountId, name: `Homologacao 3A ${label}`, code: `3A_${suffix}_${label}`,
  } })
  const workflowId = randomUUID()
  await db!.workflows.create({ data: {
    id: workflowId, public_id: randomUUID(), account_id: accountId, process_id: process.id,
    name: `Homologacao 3A ${label}`, status: 'published',
  } })
  workflowIds.push(workflowId)
  const nodes = kind === 'simple'
    ? [['auto', 'serviceTask', { automation: { enabled: true, type: 'noop' } }], ['end', 'endEvent', {}]] as const
    : [['fork', 'parallelGateway', { joinElementId: 'join' }],
        ['a', 'serviceTask', { automation: { enabled: true, type: 'noop' } }],
        ['b', 'userTask', {}], ['join', 'parallelGateway', {}], ['end', 'endEvent', {}]] as const
  for (const [index, node] of nodes.entries()) {
    const [element_id, element_kind, config] = node
    await db!.workflow_elements.create({ data: {
      workflow_id: workflowId, account_id: accountId,
      element_id, element_kind, element_type: element_kind, config,
      name: `${label} ${element_id}`, order_index: index,
      is_end: element_id === 'end',
    } })
  }
  const edges = kind === 'simple' ? [['auto', 'end']] :
    [['fork', 'a'], ['fork', 'b'], ['a', 'join'], ['b', 'join'], ['join', 'end']]
  for (const [index, [source_element_id, target_element_id]] of edges.entries()) {
    await db!.workflow_transitions.create({ data: {
      workflow_id: workflowId, account_id: accountId, sequence_flow_id: `${suffix}_${label}_${index}`,
      source_element_id, target_element_id,
    } })
  }
  if (kind === 'and') {
    await db!.workflow_activity_actions.create({ data: {
      workflow_id: workflowId, element_id: 'b', action_key: 'complete',
      action_name: 'Concluir', action_label: 'Concluir', is_active: true,
    } })
  }
  const base = await db!.documents.create({ data: {
    account_id: accountId, process_id: process.id, workflow_id: workflowId,
    title: `Homologacao ${label}`, code: `3A-${suffix}-${label}`,
    created_by_id: actor.id, created_by_name: actor.name,
  } })
  const current = kind === 'and' ? 'fork' : 'auto'
  const instance = await db!.document_instances.create({ data: {
    account_id: accountId, process_id: process.id, workflow_id: workflowId,
    document_id: base.id, title: `Homologacao ${label}`, code: `3A-${suffix}-${label}`,
    current_element_id: current, current_step_name: current, status: 'in_progress',
    created_by_id: actor.id, created_by_name: actor.name,
  } })
  await db!.documents.update({ where: { id: base.id }, data: { current_instance_id: instance.id } })
  const d = { id: instance.id, workflowId, processId: process.id }
  documents.push(d)
  return d
}

function services() {
  const access = new ResourceAccessService(db!)
  const parent = new ParentResumeService(db!)
  const runtime = new WorkflowTokenRuntimeService(db!, access, parent)
  const automation = new WorkflowAutomationService(db!, access, parent, runtime)
  const queue = new WorkflowAutomationQueueService(db!, automation, parent)
  return { runtime, automation, queue }
}

async function jobOf(docId: string) {
  const job = await db!.workflow_automation_jobs.findFirst({ where: {
    account_id: accountId, document_instance_id: docId,
  } })
  assert.ok(job, `Job nao encontrado: ${docId}`)
  return job
}

async function historyCount(docId: string, elementId = 'auto') {
  return db!.document_action_history.count({ where: {
    document_instance_id: docId, element_id: elementId, action_id: 'automation.noop',
  } })
}

async function run() {
  await db!.accounts.create({ data: { id: accountId, name: `Homologacao Fase 3A ${suffix}` } })
  accountCreated = true
  const normal = await newWorkflow('normal')
  const retry = await newWorkflow('retry')
  const dead = await newWorkflow('dead')
  const recovery = await newWorkflow('recovery')
  const parallel = await newWorkflow('parallel', 'and')
  let { queue, runtime } = services()

  console.log('1/8 Descoberta da fila, isolada por conta e idempotente')
  await queue.discover(accountId)
  assert.equal(await db!.workflow_automation_jobs.count({ where: { account_id: accountId } }), 4)
  await queue.discover(accountId)
  assert.equal(await db!.workflow_automation_jobs.count({ where: { account_id: accountId } }), 4)

  console.log('2/8 Execucao noop e historico exatamente uma vez')
  const normalJob = await jobOf(normal.id)
  // Other fixture jobs remain queued, so dispatch the normal job by making the rest unavailable.
  await db!.workflow_automation_jobs.updateMany({ where: { account_id: accountId,
    id: { not: normalJob.id } }, data: { available_at: new Date(Date.now() + 3600000) } })
  // Torna o job explicitamente elegivel no relogio DO BANCO, evitando
  // diferencas entre relogios do cliente Node.js e PostgreSQL.
  await db!.workflow_automation_jobs.update({
    where: { id: normalJob.id }, data: { available_at: new Date(0) },
  })
  const success = await queue.process(1, accountId)
  const diagnostic = await jobOf(normal.id)
  console.log('DIAGNOSTICO 3A: resultado do process =', JSON.stringify(success))
  console.log('DIAGNOSTICO 3A: job normal =', JSON.stringify({
    id: diagnostic.id, status: diagnostic.status,
    attempt_count: diagnostic.attempt_count, last_error: diagnostic.last_error,
    available_at: diagnostic.available_at, locked_at: diagnostic.locked_at,
  }))
  if (success.completed !== 1) {
    const recent = await db!.workflow_automation_jobs.findMany({ where: { account_id: accountId },
      select: { element_id: true, status: true, attempt_count: true, last_error: true,
        available_at: true }, orderBy: { created_at: 'asc' }, take: 10 })
    console.log('DIAGNOSTICO 3A: fila temporaria =', JSON.stringify(recent))
  }
  assert.equal(success.completed, 1, `Resultado: ${JSON.stringify(success)}; job: ${diagnostic.status}; erro: ${diagnostic.last_error}`)
  assert.equal(diagnostic.status, 'completed')
  assert.equal(await historyCount(normal.id), 1)
  assert.equal((await db!.document_instances.findUniqueOrThrow({ where: { id: normal.id } })).status, 'completed')

  console.log('3/8 Falha real e retry persistido; corrigir grafo e retomar')
  await db!.workflow_transitions.deleteMany({ where: { workflow_id: retry.workflowId } })
  await db!.workflow_automation_jobs.updateMany({ where: { document_instance_id: retry.id },
    data: { available_at: new Date(0) } })
  const failedOnce = await queue.process(1, accountId)
  assert.equal(failedOnce.retried, 1)
  const first = await jobOf(retry.id)
  assert.equal(first.status, 'retry')
  assert.equal(first.attempt_count, 1)
  assert.ok(first.last_error)
  await db!.workflow_transitions.create({ data: {
    workflow_id: retry.workflowId, account_id: accountId,
    sequence_flow_id: `${suffix}_retry_repaired`, source_element_id: 'auto', target_element_id: 'end',
  } })
  await db!.workflow_automation_jobs.updateMany({ where: { document_instance_id: retry.id },
    data: { available_at: new Date(0) } })
  assert.equal((await queue.process(1, accountId)).completed, 1)
  assert.equal((await jobOf(retry.id)).attempt_count, 2)
  assert.equal(await historyCount(retry.id), 1)

  console.log('4/8 Falha repetida encerra como dead-letter')
  await db!.workflow_transitions.deleteMany({ where: { workflow_id: dead.workflowId } })
  await db!.workflow_automation_jobs.updateMany({ where: { document_instance_id: dead.id },
    data: { available_at: new Date(0), max_attempts: 2 } })
  assert.equal((await queue.process(1, accountId)).retried, 1)
  await db!.workflow_automation_jobs.updateMany({ where: { document_instance_id: dead.id },
    data: { available_at: new Date(0) } })
  assert.equal((await queue.process(1, accountId)).dead, 1)
  assert.equal((await jobOf(dead.id)).status, 'dead')
  assert.equal((await jobOf(dead.id)).attempt_count, 2)
  assert.equal(await historyCount(dead.id), 0)

  console.log('5/8 Worker recupera lease expirado')
  await db!.workflow_automation_jobs.updateMany({ where: { document_instance_id: recovery.id },
    data: { status: 'running', attempt_count: 1, locked_at: new Date(Date.now() - 600000), available_at: new Date(0) } })
  assert.equal((await queue.process(1, accountId)).completed, 1)
  assert.equal((await jobOf(recovery.id)).status, 'completed')
  assert.equal((await jobOf(recovery.id)).attempt_count, 2)

  console.log('6/8 Worker executa serviceTask dentro de ramo AND')
  assert.equal((await runtime.start(actor, parallel.id)).active, 2)
  await queue.discover(accountId)
  const tokenJobs = await db!.workflow_automation_jobs.findMany({ where: {
    account_id: accountId, document_instance_id: parallel.id,
  } })
  assert.equal(tokenJobs.length, 1)
  assert.ok(tokenJobs[0].token_id)
  // Evita depender do instante de criacao do job para o teste deterministico.
  await db!.workflow_automation_jobs.update({
    where: { id: tokenJobs[0].id }, data: { available_at: new Date(0) },
  })
  const token = await db!.workflow_execution_tokens.findFirstOrThrow({ where: {
    document_instance_id: parallel.id, branch_key: 'b',
  } })
  assert.equal((await queue.process(1, accountId)).completed, 1)
  assert.equal(await historyCount(parallel.id, 'a'), 1)
  assert.equal((await runtime.action(actor, parallel.id, token.id, { actionId: 'complete' })).joined, true)
  assert.equal((await db!.document_instances.findUniqueOrThrow({ where: { id: parallel.id } })).status, 'completed')

  console.log('7/8 Reconciliacao sem duplicar execução e sem novas filas')
  await queue.discover(accountId)
  assert.equal((await db!.workflow_automation_jobs.count({ where: { account_id: accountId } })), 5)
  assert.equal((await queue.process(2, accountId)).processed, 0)
  assert.equal(await historyCount(normal.id), 1)
  assert.equal(await historyCount(parallel.id, 'a'), 1)

  console.log('8/8 Reconexao ao Neon confirma persistencia dos resultados')
  await db!.$disconnect()
  db = new PrismaService()
  await db.$connect()
  ;({ queue } = services())
  const jobs = await queue.list(accountId)
  assert.equal(jobs.length, 5)
  assert.equal(jobs.filter(j => j.status === 'completed').length, 4)
  assert.equal(jobs.filter(j => j.status === 'dead').length, 1)
  assert.equal(await historyCount(normal.id), 1)
  console.log('HOMOLOGACAO 3A: TODOS OS 8 CENARIOS APROVADOS')
}

async function cleanup() {
  if (!db || !accountCreated) return
  // Strictly scoped to the newly created temporary account. No existing account is touched.
  const rows = await db.document_instances.findMany({ where: { account_id: accountId }, select: { id: true } })
  const ids = rows.map(d => d.id)
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
  await db.accounts.deleteMany({ where: { id: accountId } })
  console.log(`Dados exclusivos ${accountId} removidos.`)
}

async function main() {
  preflight()
  let error: unknown = null
  try {
    db = new PrismaService()
    await db.$connect()
    await run()
  } catch (e) {
    error = e
    console.error('HOMOLOGACAO 3A FALHOU:', e)
  } finally {
    if (db) {
      try { await cleanup() } catch (e) {
        console.error(`LIMPEZA INCOMPLETA: verificar SOMENTE a conta ${accountId}`, e)
        if (!error) error = e
      }
      await db.$disconnect()
    }
  }
  if (error) process.exitCode = 1
}
void main()
