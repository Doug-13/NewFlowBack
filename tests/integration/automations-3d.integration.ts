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
import { WorkflowHttpService } from '../../src/workflow-automation/workflow-http.service'
import { WorkflowTokenRuntimeService } from '../../src/workflow-runtime/workflow-token-runtime.service'
import { isPublicIPv4, validateHttpDestination } from '../../src/workflow-automation/workflow-http-policy'

// Homologacao real do banco + simulacao do transporte HTTPS. NENHUMA requisicao externa e realizada.
const suffix = randomUUID().replace(/-/g, '').slice(0,16)
const accountId = `BPMN3D_${suffix}`
const adminId = '3d-homologation-system'
let db: PrismaService | null = null
let accountCreated = false
const workflowIds: string[] = []
const previousAllow = process.env.NEWFLOW_HTTP_ALLOWED_HOSTS
const previousEnable = process.env.NEWFLOW_HTTP_ENABLED
const endpoint = 'https://api.exemplo.com/endpoint'

type Doc = { id: string; workflowId: string }

function preflight() {
  assert.equal(process.env.BPMN_3D_CONFIRM, 'HOMOLOGAR3D')
  assert.notEqual(process.env.NEWFLOW_AUTOMATION_WORKER_ENABLED, 'true')
  const url = new URL(process.env.DATABASE_URL ?? '')
  assert.ok(url.hostname.endsWith('.neon.tech'))
  assert.equal(url.hostname.toLowerCase(), process.env.BPMN_3D_EXPECTED_HOST?.toLowerCase())
  assert.equal(url.pathname.replace(/^\//,''), 'neondb')
  process.env.NEWFLOW_HTTP_ALLOWED_HOSTS = 'api.exemplo.com'
  process.env.NEWFLOW_HTTP_ENABLED = 'false'
  console.log(`Banco de testes ${url.hostname}/neondb; conta temporaria ${accountId}`)
  console.log('ATENCAO: transporte HTTPS simulado; nenhuma chamada externa sera realizada.')
}

async function fixture(label:string, method:'GET'|'POST'|'PATCH'='POST', bad=false):Promise<Doc> {
  const process = await db!.processes.create({ data:{
    account_id:accountId,name:`Homologacao 3D ${label}`,code:`3D_${suffix}_${label}`,
  }})
  const workflowId = randomUUID()
  await db!.workflows.create({data:{
    id:workflowId,public_id:randomUUID(),account_id:accountId,
    process_id:process.id,name:`Homologacao 3D ${label}`,status:'published',
  }})
  workflowIds.push(workflowId)
  for(const [index,element] of [
    {id:'http',kind:'serviceTask',config:{automation:{enabled:true,type:'http',http:{url:endpoint,method,body:method==='GET'?undefined:{action:'homologacao'}}}}},
    {id:'end',kind:'endEvent',config:{}},
  ].entries()) {
    await db!.workflow_elements.create({data:{
      workflow_id:workflowId,account_id:accountId,element_id:element.id,
      element_type:element.kind,element_kind:element.kind,name:`${label} ${element.id}`,
      order_index:index,config:element.config,is_end:element.id==='end',
    }})
  }
  if(!bad) await db!.workflow_transitions.create({data:{
    workflow_id:workflowId,account_id:accountId,
    sequence_flow_id:`${suffix}_${label}_finish`,source_element_id:'http',target_element_id:'end',
  }})
  const base=await db!.documents.create({data:{
    account_id:accountId,process_id:process.id,workflow_id:workflowId,
    title:`3D ${label}`,code:`3D-${suffix}-${label}`,created_by_id:adminId,
  }})
  const instance=await db!.document_instances.create({data:{
    account_id:accountId,process_id:process.id,workflow_id:workflowId,
    document_id:base.id,title:`3D ${label}`,code:`3D-${suffix}-${label}`,
    current_element_id:'http',current_step_name:'http',status:'in_progress',created_by_id:adminId,
  }})
  await db!.documents.update({where:{id:base.id},data:{current_instance_id:instance.id}})
  return {id:instance.id,workflowId}
}

const calls:Array<{method:string; key:string; doc:string}> = []
let shouldFail=false
let failMessage='falha simulada antes do envio'
const transport={send:async (config:{method:string}, key:string, doc:string):Promise<number>=>{
  if(shouldFail) throw new Error(failMessage)
  calls.push({method:config.method,key,doc})
  return 200
}}
function services(){
  const access=new ResourceAccessService(db!)
  const parent=new ParentResumeService(db!)
  const runtime=new WorkflowTokenRuntimeService(db!,access,parent)
  const automation=new WorkflowAutomationService(db!,access,parent,runtime)
  const schedule=new WorkflowScheduleService(db!,parent)
  const events=new WorkflowEventService(db!,access,parent)
  const http=new WorkflowHttpService(db!,transport as any,parent)
  const queue=new WorkflowAutomationQueueService(db!,automation,parent,schedule,events,http)
  return {queue,http}
}
async function job(doc:Doc){
  const result=await db!.workflow_automation_jobs.findFirst({where:{account_id:accountId,document_instance_id:doc.id,job_kind:'http'}})
  assert.ok(result,`Job HTTP nao encontrado para ${doc.id}`)
  return result
}
async function activate(id:string){
  await db!.workflow_automation_jobs.updateMany({where:{account_id:accountId,status:{in:['queued','retry']},id:{not:id}},data:{available_at:new Date(Date.now()+86400000)}})
  await db!.workflow_automation_jobs.update({where:{id},data:{available_at:new Date(0)}})
}
async function history(doc:Doc){return db!.document_action_history.count({where:{document_instance_id:doc.id,action_id:'automation.http'}})}
async function run(){
  await db!.accounts.create({data:{id:accountId,name:`Homologacao 3D ${suffix}`}})
  accountCreated=true
  const normal=await fixture('normal','POST')
  const patch=await fixture('patch','PATCH')
  const get=await fixture('get','GET')
  const stale=await fixture('stale','POST')
  const broken=await fixture('broken','POST',true)
  const retry=await fixture('retry','POST')
  let {queue}=services()

  console.log('1/8 Descoberta HTTP na fila com idempotencia e isolamento de conta')
  const first=await queue.discover(accountId)
  assert.ok(first.discovered>=6)
  const count=await db!.workflow_automation_jobs.count({where:{account_id:accountId,job_kind:'http'}})
  assert.equal(count,6)
  await queue.discover(accountId)
  assert.equal(await db!.workflow_automation_jobs.count({where:{account_id:accountId,job_kind:'http'}}),count)

  console.log('2/8 POST simulado avanca BPMN, grava um historico e conclui o job')
  const normalJob=await job(normal)
  await activate(normalJob.id)
  assert.equal((await queue.process(1,accountId)).completed,1)
  assert.equal((await db!.document_instances.findUniqueOrThrow({where:{id:normal.id}})).status,'completed')
  assert.equal(await history(normal),1)
  assert.equal(calls.filter(x=>x.doc===normal.id).length,1)
  assert.equal(calls.find(x=>x.doc===normal.id)?.key,normalJob.idempotency_key)

  console.log('3/8 GET e PATCH simulados com identificadores distintos')
  for(const doc of [get,patch]){
    const j=await job(doc)
    await activate(j.id)
    assert.equal((await queue.process(1,accountId)).completed,1)
    assert.equal(await history(doc),1)
  }
  assert.equal(calls.find(x=>x.doc===get.id)?.method,'GET')
  assert.equal(calls.find(x=>x.doc===patch.id)?.method,'PATCH')

  console.log('4/8 Bloqueio de destinos internos e allowlist restrita')
  assert.throws(()=>validateHttpDestination('http://api.exemplo.com','api.exemplo.com'))
  assert.throws(()=>validateHttpDestination('https://localhost','localhost'))
  assert.throws(()=>validateHttpDestination('https://outro.exemplo.com','api.exemplo.com'))
  assert.equal(isPublicIPv4('127.0.0.1'),false)
  assert.equal(isPublicIPv4('10.0.0.1'),false)
  assert.equal(isPublicIPv4('169.254.169.254'),false)

  console.log('5/8 Job obsoleto nao envia requisicao e nao altera historico')
  const staleJob=await job(stale)
  await db!.document_instances.update({where:{id:stale.id},data:{current_element_id:'end',status:'completed'}})
  await activate(staleJob.id)
  const before=calls.length
  assert.equal((await queue.process(1,accountId)).skipped,1)
  assert.equal(calls.length,before)
  assert.equal(await history(stale),0)

  console.log('6/8 Grafo invalido produz retry sem enviar HTTP')
  const brokenJob=await job(broken)
  await activate(brokenJob.id)
  const old=calls.length
  assert.equal((await queue.process(1,accountId)).retried,1)
  assert.equal(calls.length,old)
  assert.equal(await history(broken),0)
  await db!.workflow_transitions.create({data:{
    workflow_id:broken.workflowId,account_id:accountId,
    sequence_flow_id:`${suffix}_broken_repaired`,source_element_id:'http',target_element_id:'end',
  }})
  await activate(brokenJob.id)
  assert.equal((await queue.process(1,accountId)).completed,1)
  assert.equal(await history(broken),1)

  console.log('7/8 Falha simulada de transporte gera retry, recupera com mesma chave')
  const retryJob=await job(retry)
  await activate(retryJob.id)
  shouldFail=true
  assert.equal((await queue.process(1,accountId)).retried,1)
  assert.equal(await history(retry),0)
  assert.equal((await db!.workflow_automation_jobs.findUniqueOrThrow({where:{id:retryJob.id}})).status,'retry')
  shouldFail=false
  await activate(retryJob.id)
  assert.equal((await queue.process(1,accountId)).completed,1)
  assert.equal(await history(retry),1)
  assert.equal(calls.find(x=>x.doc===retry.id)?.key,retryJob.idempotency_key)

  console.log('8/8 Reconexao Neon valida historico, jobs e ausencia de duplicatas')
  await db!.$disconnect()
  db=new PrismaService()
  await db.$connect()
  ;({queue}=services())
  assert.equal(await db!.workflow_automation_jobs.count({where:{account_id:accountId,job_kind:'http'}}),count)
  assert.equal(await db!.document_action_history.count({where:{document_instance_id:{in:[normal.id,patch.id,get.id,stale.id,broken.id,retry.id]},action_id:'automation.http'}}),5)
  assert.equal((await queue.process(10,accountId)).processed,0)
  assert.equal(calls.length,5)
  console.log('HOMOLOGACAO 3D: 8 CENARIOS BANCO + HTTP SIMULADO APROVADOS')
}
async function cleanup(){
  if(!db||!accountCreated) return
  const docs=await db.document_instances.findMany({where:{account_id:accountId},select:{id:true}})
  const ids=docs.map(d=>d.id)
  await db.workflow_automation_jobs.deleteMany({where:{account_id:accountId}})
  await db.workflow_events.deleteMany({where:{account_id:accountId}})
  await db.workflow_notifications.deleteMany({where:{account_id:accountId}})
  await db.workflow_execution_tokens.deleteMany({where:{account_id:accountId}})
  await db.document_action_history.deleteMany({where:{document_instance_id:{in:ids}}})
  await db.audit_logs.deleteMany({where:{document_instance_id:{in:ids}}})
  await db.document_relations.deleteMany({where:{account_id:accountId}})
  await db.documents.updateMany({where:{account_id:accountId},data:{current_instance_id:null}})
  await db.document_instances.deleteMany({where:{account_id:accountId}})
  await db.documents.deleteMany({where:{account_id:accountId}})
  await db.workflow_activity_actions.deleteMany({where:{workflow_id:{in:workflowIds}}})
  await db.workflow_transitions.deleteMany({where:{account_id:accountId}})
  await db.workflow_elements.deleteMany({where:{account_id:accountId}})
  await db.workflows.deleteMany({where:{account_id:accountId}})
  await db.processes.deleteMany({where:{account_id:accountId}})
  await db.users.deleteMany({where:{account_id:accountId}})
  await db.accounts.deleteMany({where:{id:accountId}})
  console.log(`Dados temporarios ${accountId} removidos.`)
}
async function main(){
  preflight()
  let failure:unknown=null
  try {db=new PrismaService();await db.$connect();await run()}
  catch(error){failure=error;console.error('HOMOLOGACAO 3D FALHOU:',error)}
  finally{
    if(db){try{await cleanup()}catch(error){console.error(`LIMPEZA INCOMPLETA: investigar somente ${accountId}`,error);failure??=error};await db.$disconnect()}
    if(previousAllow===undefined)delete process.env.NEWFLOW_HTTP_ALLOWED_HOSTS;else process.env.NEWFLOW_HTTP_ALLOWED_HOSTS=previousAllow
    if(previousEnable===undefined)delete process.env.NEWFLOW_HTTP_ENABLED;else process.env.NEWFLOW_HTTP_ENABLED=previousEnable
  }
  if(failure)process.exitCode=1
}
void main()
