import { CanActivate, ExecutionContext, Injectable, BadRequestException } from '@nestjs/common'
import { ResourceAccessService } from './resource-access.service'

@Injectable()
export class ResourceAccessGuard implements CanActivate {
  constructor(private readonly access: ResourceAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const user = req.user
    const method = String(req.method).toUpperCase()
    // originalUrl inclui o prefixo global /api; route.path sozinho nao inclui o controller.
    const route = String(req.originalUrl || req.url || (String(req.baseUrl || '') + String(req.route?.path || ''))).split('?')[0].replace(/\/+$/, '')
    const id = req.params?.id as string | undefined

    if (/^\/(?:api\/)?workflows(?:\/|$)/.test(route)) {
      if (method !== 'GET') this.access.assertAdmin(user)
      if (id) await this.access.workflow(user, id, method !== 'GET')
      return true
    }
    if (/^\/(?:api\/)?metadata(?:\/|$)/.test(route)) {
      if (/\/definitions(?:\/|$)/.test(route)) {
        if (method !== 'GET') this.access.assertAdmin(user)
      } else if (/\/values(?:\/|$)/.test(route)) {
        await this.access.document(user, req.params.documentInstanceId, method === 'GET' ? 'read' : 'write')
      } else if (/\/form-fields(?:\/|$)/.test(route)) {
        await this.access.document(user, req.params.documentId, 'read')
      }
      return true
    }
    if (/^\/(?:api\/)?document-instances(?:\/|$)/.test(route)) {
      if (method === 'POST' && !id) {
        const processId = String(req.body?.processId ?? '')
        const workflowId = String(req.body?.workflowId ?? '')
        if (!processId || !workflowId) throw new BadRequestException('Processo e workflow são obrigatórios.')
        await this.access.process(user, processId, 'create')
        const workflow = await this.access.workflow(user, workflowId)
        if (workflow.process_id !== processId) throw new BadRequestException('Workflow não pertence ao processo informado.')
      } else if (id) {
        let action: 'read' | 'write' | 'execute' | 'admin' = 'read'
        if (method === 'DELETE' && !route.includes('/files/')) action = 'admin'
        else if (route.endsWith('/actions')) action = 'execute'
        else if (/\/(publish|cancel|reopen|archive)$/.test(route)) action = 'admin'
        else if (method !== 'GET') action = 'write'
        await this.access.document(user, id, action)
      }
      return true
    }
    return true
  }
}
