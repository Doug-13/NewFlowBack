import test from 'node:test'
import assert from 'node:assert/strict'
import { AuthSessionsService } from '../src/auth/auth-sessions.service'
import { isValidSessionId, newSessionId, tokenFingerprint } from '../src/auth/session-security'

test('gera identificadores de sessao aleatorios validos', () => {
  const first = newSessionId()
  const second = newSessionId()
  assert.equal(isValidSessionId(first), true)
  assert.notEqual(first, second)
  assert.equal(isValidSessionId('123'), false)
})

test('fingerprint de token e deterministico e nao expoe o token', () => {
  const result = tokenFingerprint('segredo-de-teste')
  assert.equal(result.length, 64)
  assert.equal(result, tokenFingerprint('segredo-de-teste'))
  assert.notEqual(result, tokenFingerprint('outro-token'))
  assert.ok(!result.includes('segredo'))
})

test('login grava somente hash do token, usuario e conta', async () => {
  let written: any
  const service = new AuthSessionsService({ auth_sessions: {
    create: async (args: any) => { written = args.data },
  } } as any)
  const id = newSessionId()
  await service.createSession('user-1', 'conta-1', id, 'jwt-de-teste')
  assert.equal(written.id, id)
  assert.equal(written.user_id, 'user-1')
  assert.equal(written.account_id, 'conta-1')
  assert.equal(written.token_hash, tokenFingerprint('jwt-de-teste'))
  assert.ok(written.expires_at.getTime() > Date.now())
})

test('guard aceita somente sessao ativa vinculada ao usuario, conta e token', async () => {
  let query: any
  const service = new AuthSessionsService({ auth_sessions: {
    findFirst: async (args: any) => { query = args; return { id: args.where.id } },
  } } as any)
  const id = newSessionId()
  await service.assertActive('u', 'a', id, 'jwt')
  assert.equal(query.where.user_id, 'u')
  assert.equal(query.where.account_id, 'a')
  assert.equal(query.where.token_hash, tokenFingerprint('jwt'))
  assert.equal(query.where.revoked_at, null)
  assert.ok(query.where.expires_at.gt instanceof Date)
})

test('guard rejeita token sem sessao e token revogado', async () => {
  const service = new AuthSessionsService({ auth_sessions: {
    findFirst: async () => null,
  } } as any)
  await assert.rejects(service.assertActive('u', 'a', '', 'jwt'))
  await assert.rejects(service.assertActive('u', 'a', newSessionId(), 'jwt'))
})

test('logout revoga somente sessao do usuario e da conta', async () => {
  let query: any
  const service = new AuthSessionsService({ auth_sessions: {
    updateMany: async (args: any) => { query = args; return { count: 1 } },
  } } as any)
  const id = newSessionId()
  assert.equal(await service.revoke('u', 'a', id), true)
  assert.equal(query.where.user_id, 'u')
  assert.equal(query.where.account_id, 'a')
  assert.equal(query.where.id, id)
  assert.ok(query.data.revoked_at instanceof Date)
})

test('logout geral revoga apenas sessoes do usuario autenticado', async () => {
  let query: any
  const service = new AuthSessionsService({ auth_sessions: {
    updateMany: async (args: any) => { query = args; return { count: 2 } },
  } } as any)
  assert.equal(await service.revokeAll('u', 'a'), 2)
  assert.deepEqual(query.where, { user_id: 'u', account_id: 'a', revoked_at: null })
})

test('listagem de sessoes nao devolve token nem hash', async () => {
  const id = newSessionId()
  const now = new Date()
  const service = new AuthSessionsService({ auth_sessions: {
    findMany: async () => [{ id, created_at: now, expires_at: now }],
  } } as any)
  const result = await service.list('u', 'a', id)
  assert.deepEqual(result, [{ id, createdAt: now, expiresAt: now, current: true }])
})
