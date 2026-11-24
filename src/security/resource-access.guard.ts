import { CanActivate, ExecutionContext, Injectable, BadRequestException } from '@nestjs/common'
import { ResourceAccessService } from './resource-access.service'

@Injectable()
export class ResourceAccessGuard implements CanActivate {
  constructor(private readonly access: ResourceAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const user = req.user
    const method = String(req.method).toUpperCase()
    const id = req.params?.id as string | undefined
    const route = String(req.baseUrl || '') + String(req.route?.path || '')

    if (route.startsWith('/api/workflows') || route.startsWith('/workflows')) {
      if (method !== 'GET') this.access.assertAdmin(user)
      if (id) await this.access.workflow(user, id, method !== 'GET')
      return true
    }
    if (route.startsWith('/api/metadata') || route.startsWith('/metadata')) {
      if (route.includes('/definitions')) {
        if (method !== 'GET') this.access.assertAdmin(user)
      } else if (route.includes('/values/')) {
        await this.access.document(user, req.params.documentInstanceId, method === 'GET' ? 'read' : 'write')
      } else if (route.includes('/form-fields/')) {
        await this.access.document(user, req.params.documentId, 'read')
      }
      return true
    }
    if (route.includes('document-instances')) {
      if (!id && method === 'POST') {
        const processId = String(req.body?.processId ?? '')
        const workflowId = String(req.body?.workflowId ?? '')
        if (!processId || !workflowId) throw new BadRequestException('Processo e workflow são obrigatórios.')
        await this.access.process(user, processId, 'create')
        const workflow = await this.access.workflow(user, workflowId)
        if (workflow.process_id !== processId) throw new BadRequestException('Workflow não pertence ao processo informado.')
      } else if (id) {
        let action: 'read' | 'write' | 'execute' | 'admin' = 'read'
        if (method === 'DELETE' && !route.includes('/files/')) action = 'admin'
        else if (route.includes('/actions')) action = 'execute'
        else if (route.includes('/publish') || route.includes('/cancel') || route.includes('/reopen') || route.includes('/archive')) action = 'admin'
        else if (method !== 'GET') action = 'write'
        await this.access.document(user, id, action)
      }
      return true
    }
    return true
  }
}
