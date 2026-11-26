import assert from 'node:assert/strict'
import { test } from 'node:test'
import { OrganizationController } from '../src/organization/organization.controller'
import { OrganizationService } from '../src/organization/organization.service'
import { ResourceAccessGuard } from '../src/security/resource-access.guard'

const admin = { id: 'admin1', role: 'admin', accountId: 'A' }
const common = { id: 'user1', role: 'user', accountId: 'A' }

test('organizacao: alteracoes exigem admin e ignoram accountId do body', async () => {
  let account: string | undefined
  const svc: any = {
    createUnit: async (data: any) => { account = data.accountId; return data },
    updateArea: async () => ({}), deleteGroup: async () => ({}),
  }
  const ctl = new OrganizationController(svc)
  assert.throws(() => ctl.createUnit({ accountId: 'B' }, common))
  assert.throws(() => ctl.updateArea('id', {}, common))
  assert.throws(() => ctl.deleteGroup('id', common))
  await ctl.createUnit({ accountId: 'B' }, admin)
  assert.equal(account, 'A')
})

test('organizacao: listagem e consulta por id sempre filtram conta', async () => {
  let listWhere: any
  let getWhere: any
  const prisma: any = { organization_areas: {
    findMany: async ({ where }: any) => { listWhere = where; return [] },
    findFirst: async ({ where }: any) => { getWhere = where; return null },
  } }
  const service = new OrganizationService(prisma)
  await service.units('A')
  assert.equal(listWhere.account_id, 'A')
  await assert.rejects(service.unit('outro', 'A'))
  assert.equal(getWhere.account_id, 'A')
  assert.equal(getWhere.id, 'outro')
})

test('organizacao: grupos recusam membro pertencente a outra conta', async () => {
  let created = false
  const prisma: any = {
    users: { findMany: async () => [] },
    organization_groups: { create: async () => { created = true; return {} } },
  }
  await assert.rejects(new OrganizationService(prisma).createGroup({ accountId: 'A', name: 'G', memberIds: ['usuario-B'] }))
  assert.equal(created, false)
})

test('guarda documental: usa originalUrl para proteger download', async () => {
  let inspected: any
  const svc: any = { document: async (...args: any[]) => { inspected = args } }
  const guard = new ResourceAccessGuard(svc)
  const request: any = { user: common, method: 'GET', originalUrl: '/api/document-instances/doc-1/files/file-1/download', params: { id: 'doc-1', fileId: 'file-1' }, route: { path: ':id/files/:fileId/download' } }
  const context: any = { switchToHttp: () => ({ getRequest: () => request }) }
  assert.equal(await guard.canActivate(context), true)
  assert.deepEqual(inspected, [common, 'doc-1', 'read'])
})

test('guarda documental: operacoes de publicacao sao administrativas', async () => {
  let inspected: any
  const svc: any = { document: async (...args: any[]) => { inspected = args } }
  const guard = new ResourceAccessGuard(svc)
  const request: any = { user: common, method: 'PATCH', originalUrl: '/api/document-instances/doc-1/publish', params: { id: 'doc-1' } }
  const context: any = { switchToHttp: () => ({ getRequest: () => request }) }
  await guard.canActivate(context)
  assert.deepEqual(inspected, [common, 'doc-1', 'admin'])
})
