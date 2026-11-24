import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { ResourceAccessService } from '../src/security/resource-access.service'
import { ResourceAccessGuard } from '../src/security/resource-access.guard'

const admin = { id: 'admin-1', accountId: 'empresa-A', role: 'admin' }
const reader = { id: 'user-1', accountId: 'empresa-A', role: 'user' }
const process = { id: 'p1', account_id: 'empresa-A', is_active: true, status: 'active', permissions: { userIds: ['user-1'], groupIds: [] }, document_visualization: { userIds: [], groupIds: [] }, document_creation: { userIds: [], groupIds: [] } }
const base = { id: 'd1', document_id: 'b1', account_id: 'empresa-A', process_id: 'p1', created_by_id: 'user-1', current_assigned_user_id: 'user-2' }
function build() {
  const prisma: any = {
    document_instances: { findFirst: async ({ where }: any) => where.id === 'd1' && where.account_id === 'empresa-A' ? base : null },
    documents: { findFirst: async () => null },
    processes: { findFirst: async ({ where }: any) => where.id === 'p1' && where.account_id === 'empresa-A' ? process : null, findMany: async () => [process] },
    workflows: { findFirst: async ({ where }: any) => where.id === 'w1' && where.account_id === 'empresa-A' ? { id: 'w1', account_id: 'empresa-A', process_id: 'p1' } : null },
    configuration_environments: { findMany: async () => [{ id: 'e1' }] },
    configuration_environment_processes: { findMany: async () => [{ environment_id: 'e1', process_id: 'p1' }] },
    user_process_memberships: { findMany: async () => [] },
    organization_groups: { findMany: async () => [] },
  }
  const access = new ResourceAccessService(prisma)
  return { access, guard: new ResourceAccessGuard(access) }
}
function ctx(user: any, method: string, route: string, params: any = {}, body: any = {}) {
  return { switchToHttp: () => ({ getRequest: () => ({ user, method, params, body, baseUrl: '', route: { path: route } }) }) } as any
}

test('conta B não pode ler documento da conta A', async () => {
  const { access } = build()
  await assert.rejects(() => access.document({ id: 'u2', accountId: 'empresa-B', role: 'admin' }, 'd1'), NotFoundException)
})
test('usuário com acesso ao processo pode ler documento', async () => {
  const { access } = build()
  assert.equal((await access.document(reader, 'd1')).id, 'd1')
})
test('usuário não designado não executa atividade', async () => {
  const { access } = build()
  await assert.rejects(() => access.document(reader, 'd1', 'execute'), ForbiddenException)
})
test('administrador da mesma conta pode atuar', async () => {
  const { access } = build()
  assert.equal((await access.document(admin, 'd1', 'admin')).id, 'd1')
})
test('outra conta não acessa workflow por ID', async () => {
  const { access } = build()
  await assert.rejects(() => access.workflow({ id: 'u2', accountId: 'empresa-B', role: 'admin' }, 'w1'), NotFoundException)
})
test('usuário comum não modifica workflow', async () => {
  const { access } = build()
  await assert.rejects(() => access.workflow(reader, 'w1', true), ForbiddenException)
})
test('guarda impede edição de metadados sem papel admin', async () => {
  const { guard } = build()
  await assert.rejects(() => guard.canActivate(ctx(reader, 'PUT', '/api/metadata/definitions/x', {id:'x'})), ForbiddenException)
})
test('guarda verifica documento antes do download', async () => {
  const { guard } = build()
  await assert.rejects(() => guard.canActivate(ctx({ id: 'user-3', accountId: 'empresa-B', role: 'admin' }, 'GET', '/api/document-instances/:id/files/:fileId/download', { id: 'd1', fileId:'f1' })), NotFoundException)
})
test('criação valida processo e workflow', async () => {
  const { guard } = build()
  await assert.rejects(() => guard.canActivate(ctx(reader, 'POST', '/api/document-instances', {}, { processId: 'p1', workflowId: 'w2' })), NotFoundException)
})
