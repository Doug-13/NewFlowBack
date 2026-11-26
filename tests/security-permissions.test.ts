import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertAdministrator } from '../src/security/admin-access'
import { UsersService } from '../src/users/users.service'
import { UsersController } from '../src/users/users.controller'
import { EnvironmentSettingsController } from '../src/environment-settings/environment-settings.controller'

const admin = { id: 'u1', role: 'admin', accountId: 'conta-A' }
const common = { id: 'u2', role: 'user', accountId: 'conta-A' }

test('operacoes administrativas rejeitam usuario comum ou nao autenticado', () => {
  assert.throws(() => assertAdministrator(common))
  assert.throws(() => assertAdministrator(null))
  assert.doesNotThrow(() => assertAdministrator(admin))
})

test('controller de usuarios impede listagem e alteracao por usuario comum', () => {
  const svc: any = { list: () => [], create: () => ({}), update: () => ({}), remove: () => ({}) }
  const ctl = new UsersController(svc)
  assert.throws(() => ctl.list(common))
  assert.throws(() => ctl.create({}, common))
  assert.throws(() => ctl.update('u3', {}, common))
  assert.throws(() => ctl.remove('u3', common))
  assert.throws(() => ctl.remove('u1', admin))
})

test('controller de configuracao so consulta a conta do token e restringe PUT', async () => {
  let consulted: unknown
  let saved: unknown
  const service: any = {
    get: async (account: string) => { consulted = account; return {} },
    save: async (account: string) => { saved = account; return {} },
  }
  const ctl = new EnvironmentSettingsController(service)
  await ctl.getSettings(common)
  assert.equal(consulted, 'conta-A')
  assert.throws(() => ctl.saveSettings({}, common))
  await ctl.saveSettings({}, admin)
  assert.equal(saved, 'conta-A')
})

test('criacao de usuario usa a conta autenticada, nao accountId do body', async () => {
  let created: any
  const prisma: any = { users: {
    findUnique: async () => null,
    create: async ({ data }: any) => { created = data; return { ...data, id: 'new' } },
  } }
  const service = new UsersService(prisma)
  await service.create({ email: 'a@b.com', name: 'Teste', password: 'senha-para-teste-123', accountId: 'conta-B' }, 'conta-A')
  assert.equal(created.account_id, 'conta-A')
})

test('criacao de usuario rejeita senha ausente ou fraca', async () => {
  const prisma: any = { users: { findUnique: async () => null } }
  await assert.rejects(() => new UsersService(prisma).create({ email: 'a@b.com' }, 'conta-A'))
})

test('atualizacao restringe consulta e escrita por conta', async () => {
  let selection: any
  let mutation: any
  const prisma: any = { users: {
    findFirst: async ({ where }: any) => { selection = where; return { id: 'u3' } },
    update: async ({ where }: any) => { mutation = where; return { id: 'u3', account_id: 'conta-A' } },
  } }
  await new UsersService(prisma).update('u3', { name: 'Novo' }, 'conta-A')
  assert.deepEqual(selection, { id: 'u3', account_id: 'conta-A' })
  assert.deepEqual(mutation, { id: 'u3', account_id: 'conta-A' })
})

test('exclusao restringe conta e devolve 404 quando nao encontra usuario', async () => {
  let deletion: any
  const prisma: any = { users: {
    deleteMany: async ({ where }: any) => { deletion = where; return { count: 0 } },
  } }
  await assert.rejects(() => new UsersService(prisma).remove('u3', 'conta-A'))
  assert.deepEqual(deletion, { id: 'u3', account_id: 'conta-A' })
})
