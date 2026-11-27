import { BadRequestException, ConflictException, Injectable } from '@nestjs/common'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ParentResumeService } from '../workflow-coordination/parent-resume.service'
import { ResourceAccessService } from '../security/resource-access.service'
import { parseEventConfig, validatePublish } from './workflow-event-policy'

const CLOSED = ['completed','published','archived','cancelled']
const FINISHED = ['completed','published','archived']
@Injectable()
export class WorkflowEventService {
  constructor(private readonly prisma: PrismaService, private readonly access: ResourceAccessService,
    private readonly parentResume: ParentResumeService) {}

  async publish(user: any, raw: unknown) {
    this.access.assertAdmin(user)
    let b: ReturnType<typeof validatePublish>
    try { b = validatePublish(raw) } catch (e) { throw new BadRequestException((e as Error).message) }
    const accountId: string = user.accountId
    return this.prisma.$transaction(async tx => {
      // Scoped idempotency: identical request returns the same event; differing contents are rejected.
      const existing = await tx.workflow_events.findUnique({ where: { account_id_request_key: {account_id:accountId, request_key:b.key} } })
      if (existing) {
        if (existing.event_type !== b.type || existing.event_name !== b.name ||
          existing.target_document_id !== (b.documentId ?? null) || existing.source_document_id !== (b.sourceDocumentId ?? null)) {
          throw new ConflictException('Chave de idempotencia reutilizada com conteudo diferente.')
        }
        return { eventId: existing.id, duplicate: true, queued: await tx.workflow_automation_jobs.count({where:{event_id:existing.id,account_id:accountId}}) }
      }
      if (b.sourceDocumentId) {
        const source = await tx.document_instances.findFirst({where:{id:b.sourceDocumentId,account_id:accountId},select:{id:true}})
        if (!source) throw new BadRequestException('Documento de origem nao encontrado.')
      }
      const where = { account_id:accountId, status:{in:['draft','in_progress']}, current_element_id:{not:null}, ...(b.documentId?{id:b.documentId}:{}) }
      // Reject large broadcasts rather than silently publish only part of a signal.
      const documents = await tx.document_instances.findMany({where,select:{id:true,workflow_id:true,current_element_id:true},take:101})
      if (b.type === 'signal' && documents.length > 100) throw new BadRequestException('Sinal excede 100 documentos candidatos; particionar o disparo.')
      if (b.type === 'message' && documents.length !== 1) throw new BadRequestException('Documento destinatario nao disponivel.')
      // 3C.1: avoid N+1 queries inside Prisma's interactive transaction.
      // A signal can match 100 candidate documents: sequential counts/findFirst calls
      // previously exhausted Prisma's 5-second transaction limit on Neon.
      const documentIds = documents.map(doc => doc.id)
      const activeTokens = documentIds.length ? await tx.workflow_execution_tokens.findMany({
        where: { account_id: accountId, document_instance_id: { in: documentIds },
          status: { in: ['active', 'arrived'] } },
        select: { document_instance_id: true },
      }) : []
      const blocked = new Set(activeTokens.map(token => token.document_instance_id))
      const candidateDocs = documents.filter(doc => !blocked.has(doc.id))
      const workflowIds = [...new Set(candidateDocs.map(doc => doc.workflow_id))]
      const elementIds = [...new Set(candidateDocs.map(doc => doc.current_element_id!))]
      const elements = workflowIds.length ? await tx.workflow_elements.findMany({
        where: { account_id: accountId, workflow_id: { in: workflowIds },
          element_id: { in: elementIds } },
        select: { workflow_id: true, element_id: true, element_kind: true, config: true },
      }) : []
      const elementConfigs = new Map(elements.map(element => [
        `${element.workflow_id}:${element.element_id}`, parseEventConfig(element),
      ]))
      const targets = candidateDocs.filter(doc => {
        const config = elementConfigs.get(`${doc.workflow_id}:${doc.current_element_id!}`)
        return config?.type === b.type && config?.name === b.name
      }).map(doc => ({ id: doc.id, workflow_id: doc.workflow_id, element_id: doc.current_element_id! }))
      if (b.type === 'message' && targets.length !== 1) throw new BadRequestException('Destinatario nao esta aguardando este evento.')
      const event = await tx.workflow_events.create({data:{account_id:accountId,request_key:b.key,event_type:b.type,event_name:b.name,
        target_document_id:b.documentId??null,source_document_id:b.sourceDocumentId??null,published_by_user_id:user.id}})
      if (targets.length) {
        await tx.workflow_automation_jobs.createMany({ data: targets.map(target => ({
          account_id: accountId, document_instance_id: target.id, workflow_id: target.workflow_id,
          element_id: target.element_id, event_id: event.id, job_kind: 'event', status: 'queued', max_attempts: 5,
          idempotency_key: `event:${event.id}:${target.id}:${target.element_id}`,
        })) })
      }
      return {eventId:event.id,duplicate:false,queued:targets.length}
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable, timeout:20000, maxWait:10000})
  }

  async execute(job: {account_id:string;document_instance_id:string;workflow_id:string;element_id:string;event_id:string|null}) {
    if (!job.event_id) throw new ConflictException('Job de evento sem identificador.')
    const outcome = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM document_instances WHERE id = ${job.document_instance_id}::uuid FOR UPDATE`
      const document = await tx.document_instances.findFirst({where:{id:job.document_instance_id,account_id:job.account_id}})
      if (!document || document.workflow_id !== job.workflow_id || CLOSED.includes(document.status) || document.current_element_id !== job.element_id) return {result:'skipped' as const,finished:false}
      const event = await tx.workflow_events.findFirst({where:{id:job.event_id!,account_id:job.account_id}})
      if (!event || (event.target_document_id && event.target_document_id !== document.id)) return {result:'skipped' as const,finished:false}
      if (await tx.workflow_execution_tokens.count({where:{account_id:job.account_id,document_instance_id:document.id,status:{in:['active','arrived']}}})) {
        throw new ConflictException('Evento em ramo paralelo nao suportado.')
      }
      const element = await tx.workflow_elements.findFirst({where:{account_id:job.account_id,workflow_id:document.workflow_id,element_id:job.element_id}})
      const config = parseEventConfig(element)
      if (!config || config.type !== event.event_type || config.name !== event.event_name) return {result:'skipped' as const,finished:false}
      const waiting = await tx.document_relations.findMany({where:{account_id:job.account_id,parent_document_instance_id:document.id,relation_type:'subprocess',wait_for_completion:true},select:{child_document_instance_id:true}})
      if (waiting.length) {
        const children = await tx.document_instances.findMany({where:{account_id:job.account_id,id:{in:waiting.map(x=>x.child_document_instance_id)}},select:{id:true,status:true}})
        const states = new Map(children.map(x=>[x.id,x.status]))
        if (waiting.some(x=>!FINISHED.includes(states.get(x.child_document_instance_id)??'missing'))) throw new ConflictException('Subprocessos pendentes.')
      }
      const transitions = await tx.workflow_transitions.findMany({where:{account_id:job.account_id,workflow_id:document.workflow_id,source_element_id:job.element_id}})
      if (transitions.length !== 1 || !transitions[0].target_element_id) throw new ConflictException('Evento exige exatamente uma transicao.')
      const target = await tx.workflow_elements.findFirst({where:{account_id:job.account_id,workflow_id:document.workflow_id,element_id:transitions[0].target_element_id}})
      if (!target || /gateway/i.test(target.element_kind??'') || /^serviceTask$/i.test(target.element_kind??'')) throw new ConflictException('Destino BPMN nao suportado.')
      const finished = Boolean(target.is_end || target.element_kind === 'endEvent')
      const changed = await tx.document_instances.updateMany({where:{id:document.id,account_id:job.account_id,current_element_id:job.element_id,status:{notIn:CLOSED}},data:{current_element_id:target.element_id,current_step_name:target.name,current_step_order_index:target.order_index,status:finished?'completed':'in_progress',updated_at:new Date()}})
      if (changed.count !== 1) throw new ConflictException('Documento alterado durante evento.')
      await tx.document_action_history.create({data:{document_instance_id:document.id,element_id:job.element_id,action_id:`event.${event.event_type}`,outcome:'completed',comment:`Evento ${event.event_name} recebido (${event.id}).`,executed_by_user_id:'system',executed_by_user_name:'NewFlow Event Worker'}})
      return {result:'completed' as const,finished}
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable, timeout:20000, maxWait:10000})
    if (outcome.finished) await this.parentResume.resumeAfterChildFinished(job.account_id,job.document_instance_id)
    return outcome.result
  }

  async list(user:any) {
    this.access.assertAdmin(user)
    return this.prisma.workflow_events.findMany({where:{account_id:user.accountId},orderBy:{created_at:'desc'},take:100,
      select:{id:true,event_type:true,event_name:true,created_at:true,request_key:true,target_document_id:true,source_document_id:true}})
  }
}
