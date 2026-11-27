import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../src/prisma/prisma.service'
import { ParentResumeService } from '../../src/workflow-coordination/parent-resume.service'
import { WorkflowTokenRuntimeService } from '../../src/workflow-runtime/workflow-token-runtime.service'

/**
 * Real PostgreSQL/Neon integration harness. NOT part of the default unit suite.
 * Creates a dedicated, isolated account (BPMN2K_*) and only deletes its own rows.
 * No network calls other than Prisma/Neon. Never uses prisma db push/reset.
 */
type Fixture = { accountId: string; parentId: string; andId: string; orId: string }
const runId = randomUUID().replace(/-/g, '').slice(0, 16)
const accountId = `BPMN2K_${runId}`
const admin = { id: 'bpmn-2k-runner', name: 'BPMN 2K Runner', role: 'admin', accountId }
let db: PrismaService | null = null
let createdAccount = false

function preflight() {
  assert.equal(process.env.BPMN_2K_CONFIRM, 'HOMOLOGAR', 'Defina BPMN_2K_CONFIRM=HOMOLOGAR antes de executar.')
  const databaseUrl = process.env.DATABASE_URL
  assert.ok(databaseUrl, 'DATABASE_URL ausente.')
  const url = new URL(databaseUrl)
  assert.ok(/(?:^|\.)neon\.tech$/.test(url.hostname), 'Este teste exige PostgreSQL hospedado no Neon.')
  assert.equal(url.hostname, process.env.BPMN_2K_EXPECTED_HOST, 'Host do Neon diferente do confirmado pelo operador.')
  console.log(`Banco confirmado: ${url.hostname} / ${url.pathname.replace(/^\//, '')}`)
  console.log(`Identificador isolado: ${accountId}`)
}

async function createWorkflow(kind: 'parallel'|'inclusive', processId: string, name: string) {
  const workflowId = randomUUID()
  const forkKind = kind === 'parallel' ? 'parallelGateway' : 'inclusiveGateway'
  const outcome = kind === 'inclusive' ? 'selected' : null
  await db!.workflows.create({ data: {
    id: workflowId, public_id: randomUUID(), account_id: accountId, process_id: processId,
    name, status: 'published', steps_count: 6,
  } })
  const elements = [
    ['fork', forkKind, { joinElementId: 'join', ...(outcome ? { outcome } : {}) }],
    ['a1', 'userTask', {}], ['a2', 'userTask', {}], ['b1', 'userTask', {}],
    ['join', forkKind, {}], ['finish', 'endEvent', {}],
    ...(kind === 'inclusive' ? [['c1', 'userTask', {}] as const] : []),
  ] as const
  for (let i = 0; i < elements.length; i++) {
    const [element_id, element_kind, config] = elements[i]
    await db!.workflow_elements.create({ data: {
      workflow_id: workflowId, account_id: accountId, element_id,
      element_type: element_kind, element_kind, name: `${name} ${element_id}`,
      order_index: i, is_end: element_id === 'finish', config,
    } })
  }
  const flows = [
    ['fork','a1'],['fork','b1'],['a1','a2'],['a2','join'],['b1','join'],['join','finish'],
    ...(kind === 'inclusive' ? [['fork','c1'] as const, ['c1','join'] as const] : []),
  ] as const
  for (let i = 0; i < flows.length; i++) {
    const [source_element_id, target_element_id] = flows[i]
    await db!.workflow_transitions.create({ data: {
      workflow_id: workflowId, account_id: accountId,
      sequence_flow_id: `flow_${i}_${runId}`, source_element_id, target_element_id,
      ...(source_element_id === 'fork' && outcome ? { outcome: target_element_id === 'c1' ? 'rejected' : outcome } : {}),
    } })
  }
  for (const element_id of [...['a1','a2','b1'], ...(kind === 'inclusive' ? ['c1'] : [])]) {
    await db!.workflow_activity_actions.create({ data: {
      workflow_id: workflowId, element_id, action_key: 'complete',
      action_name: 'Concluir', action_label: 'Concluir', is_active: true,
    } })
  }
  return workflowId
}

async function createDocument(processId: string, workflowId: string, title: string, step: string) {
  const code = `2K-${runId}-${title}`
  const base = await db!.documents.create({ data: {
    account_id: accountId, process_id: processId, workflow_id: workflowId,
    title, code, created_by_id: admin.id, created_by_name: admin.name,
  } })
  const instance = await db!.document_instances.create({ data: {
    account_id: accountId, process_id: processId, workflow_id: workflowId,
    document_id: base.id, title, code, status: 'in_progress',
    current_element_id: step, current_step_name: step,
    created_by_id: admin.id, created_by_name: admin.name,
  } })
  await db!.documents.update({ where: { id: base.id }, data: { current_instance_id: instance.id } })
  return instance
}

async function setup(): Promise<Fixture> {
  await db!.accounts.create({ data: { id: accountId, name: `Homologacao BPMN 2K ${runId}` } })
  createdAccount = true
  const process = await db!.processes.create({ data: { account_id: accountId, name: `2K ${runId}`, code: `BPMN2K_${runId}` } })
  const andWorkflowId = await createWorkflow('parallel', process.id, 'AND')
  // Unique workflow per process: create a separate process for the OR scenario.
  const orProcess = await db!.processes.create({ data: { account_id: accountId, name: `2K OR ${runId}` } })
  const orWorkflowId = await createWorkflow('inclusive', orProcess.id, 'OR')
  const parentProcess = await db!.processes.create({ data: { account_id: accountId, name: `2K Parent ${runId}` } })
  const parentWorkflow = randomUUID()
  await db!.workflows.create({ data: { id: parentWorkflow, public_id: randomUUID(),
    account_id: accountId, process_id: parentProcess.id, name: 'Parent 2K', status: 'published' } })
  for (const [id, end] of [['wait', false], ['after', false]] as const) {
    await db!.workflow_elements.create({ data: { workflow_id: parentWorkflow, account_id: accountId,
      element_id: id, element_type: 'userTask', element_kind: 'userTask',
      name: id, is_end: end } })
  }
  await db!.workflow_transitions.create({ data: { workflow_id: parentWorkflow, account_id: accountId,
    sequence_flow_id: `wait_to_after_${runId}`, source_element_id: 'wait', target_element_id: 'after' } })
  const parent = await createDocument(parentProcess.id, parentWorkflow, 'parent', 'wait')
  const andChild = await createDocument(process.id, andWorkflowId, 'and', 'fork')
  const orChild = await createDocument(orProcess.id, orWorkflowId, 'or', 'fork')
  for (const child of [andChild, orChild]) {
    await db!.document_relations.create({ data: {
      account_id: accountId, parent_document_id: parent.document_id,
      parent_document_instance_id: parent.id, child_document_id: child.document_id,
      child_document_instance_id: child.id, relation_type: 'subprocess', wait_for_completion: true,
      child_process_id: child.process_id, status: 'created',
      parent_waiting_element_id: 'wait', parent_next_element_id: 'after',
      created_by_id: admin.id, created_by_name: admin.name,
    } })
  }
  return { accountId, parentId: parent.id, andId: andChild.id, orId: orChild.id }
}

function runtime() {
  const access = { document: async (user: typeof admin, id: string) => {
    const found = await db!.document_instances.findFirst({ where: { id, account_id: user.accountId } })
    if (!found) throw new Error('Documento fora da conta de homologacao.')
    return found
  } }
  const resume = new ParentResumeService(db!)
  return new WorkflowTokenRuntimeService(db!, access as any, resume)
}

async function getTokens(documentId: string) {
  return db!.workflow_execution_tokens.findMany({ where: { account_id: accountId, document_instance_id: documentId }, orderBy: { branch_key: 'asc' } })
}

async function assertParentAt(id: string, element: string) {
  const parent = await db!.document_instances.findUniqueOrThrow({ where: { id } })
  assert.equal(parent.current_element_id, element)
}

async function scenario(fixture: Fixture) {
  let engine = runtime()
  console.log('1/8 Iniciando AND com duas ramificacoes no Neon')
  assert.equal((await engine.start(admin, fixture.andId)).active, 2)
  let andTokens = await getTokens(fixture.andId)
  assert.deepEqual(andTokens.map(t => t.branch_key), ['a1','b1'])

  console.log('2/8 Desconectando e reconectando o Prisma para verificar persistencia')
  await db!.$disconnect()
  db = new PrismaService()
  await db.$connect()
  engine = runtime()
  andTokens = await getTokens(fixture.andId)
  assert.equal(andTokens.length, 2)
  assert.ok(andTokens.every(t => t.status === 'active'))

  console.log('3/8 Acao simultanea duplicada no mesmo token')
  const a = andTokens.find(t => t.branch_key === 'a1')!
  const attempts = await Promise.allSettled([
    engine.action(admin, fixture.andId, a.id, { actionId: 'complete' }),
    engine.action(admin, fixture.andId, a.id, { actionId: 'complete' }),
  ])
  assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 1,
    'Duplicidade concorrente deve produzir exatamente um sucesso.')
  assert.equal((await db!.document_action_history.count({ where: {
    document_instance_id: fixture.andId, element_id: 'a1', action_id: 'complete',
  } })), 1)
  assert.equal((await getTokens(fixture.andId)).find(t => t.branch_key === 'a1')?.element_id, 'a2')

  console.log('4/8 Primeiro ramo AND termina; pai continua aguardando')
  const b = andTokens.find(t => t.branch_key === 'b1')!
  assert.equal((await engine.action(admin, fixture.andId, b.id, { actionId: 'complete' })).joined, false)
  await assertParentAt(fixture.parentId, 'wait')
  const aFinal = await engine.action(admin, fixture.andId, a.id, { actionId: 'complete' })
  assert.equal(aFinal.joined, true)
  assert.equal((await getTokens(fixture.andId)).filter(t => t.status === 'completed').length, 2)
  await assertParentAt(fixture.parentId, 'wait')

  console.log('5/8 Iniciando OR a partir de condicoes persistidas')
  assert.equal((await engine.start(admin, fixture.orId)).active, 2)
  const orTokens = await getTokens(fixture.orId)
  assert.equal(orTokens.length, 2)
  assert.deepEqual(orTokens.map(t => t.branch_key), ['a1', 'b1']) // c1 has a different outcome
  assert.equal((await engine.action(admin, fixture.orId,
    orTokens.find(t => t.branch_key === 'b1')!.id, { actionId: 'complete' })).joined, false)
  await assertParentAt(fixture.parentId, 'wait')
  const oa = orTokens.find(t => t.branch_key === 'a1')!
  assert.equal((await engine.action(admin, fixture.orId, oa.id, { actionId: 'complete' })).joined, false)
  assert.equal((await engine.action(admin, fixture.orId, oa.id, { actionId: 'complete' })).joined, true)

  console.log('6/8 Pai retomado automaticamente apos dois filhos concluidos')
  await assertParentAt(fixture.parentId, 'after')
  const relations = await db!.document_relations.findMany({ where: { account_id: accountId,
    parent_document_instance_id: fixture.parentId } })
  assert.equal(relations.length, 2)
  assert.ok(relations.every(r => r.parent_continued_at !== null))

  console.log('7/8 Retomada idempotente e historico unico')
  const again = await new ParentResumeService(db!).resumeAfterChildFinished(accountId, fixture.orId)
  assert.equal(again.resumed, 0)
  assert.equal(await db!.document_action_history.count({ where: {
    document_instance_id: fixture.parentId, action_id: 'subprocess.auto_resume',
  } }), 1)

  console.log('8/8 Persistencia de estado na nova consulta')
  assert.equal((await db!.document_instances.findUniqueOrThrow({ where: { id: fixture.orId } })).status, 'completed')
  assert.equal((await db!.document_instances.findUniqueOrThrow({ where: { id: fixture.andId } })).status, 'completed')
  console.log('HOMOLOGACAO BPMN 2K: TODOS OS 8 CENARIOS APROVADOS')
}

async function cleanup() {
  if (!db || !createdAccount) return
  // Delete only rows created with this unique account ID; never clean the shared account.
  const docs = await db.document_instances.findMany({ where: { account_id: accountId }, select: { id: true } })
  const docIds = docs.map(d => d.id)
  await db.workflow_execution_tokens.deleteMany({ where: { account_id: accountId } })
  await db.document_action_history.deleteMany({ where: { document_instance_id: { in: docIds } } })
  await db.audit_logs.deleteMany({ where: { document_instance_id: { in: docIds } } })
  await db.document_relations.deleteMany({ where: { account_id: accountId } })
  await db.documents.updateMany({ where: { account_id: accountId }, data: { current_instance_id: null } })
  await db.document_instances.deleteMany({ where: { account_id: accountId } })
  await db.documents.deleteMany({ where: { account_id: accountId } })
  const workflows = await db.workflows.findMany({ where: { account_id: accountId }, select: { id: true } })
  const ids = workflows.map(w => w.id)
  await db.workflow_activity_actions.deleteMany({ where: { workflow_id: { in: ids } } })
  await db.workflow_transitions.deleteMany({ where: { account_id: accountId } })
  await db.workflow_elements.deleteMany({ where: { account_id: accountId } })
  await db.workflows.deleteMany({ where: { account_id: accountId } })
  await db.processes.deleteMany({ where: { account_id: accountId } })
  await db.accounts.deleteMany({ where: { id: accountId } })
  console.log(`Dados isolados ${accountId} removidos.`)
}

async function main() {
  preflight()
  let failure: unknown = null
  try {
    db = new PrismaService()
    await db.$connect()
    const fixture = await setup()
    await scenario(fixture)
  } catch (error) {
    failure = error
    console.error('HOMOLOGACAO 2K FALHOU:', error)
  } finally {
    if (db) {
      try { await cleanup() } catch (error) {
        console.error(`LIMPEZA INCOMPLETA: conta isolada ${accountId}.`, error)
        if (!failure) failure = error
      }
      await db.$disconnect()
    }
  }
  if (failure) process.exitCode = 1
}

void main()
