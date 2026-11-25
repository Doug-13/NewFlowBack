import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { requireJwtSecret, readBearerJwt, resolveCorsOrigins } from '../src/auth/auth-security'
import { LoginThrottleService } from '../src/auth/login-throttle.service'

test('recusa segredo JWT ausente', () => assert.throws(() => requireJwtSecret(undefined)))
test('recusa segredo JWT curto ou conhecido', () => {
  assert.throws(() => requireJwtSecret('dev-secret'))
  assert.throws(() => requireJwtSecret('a'.repeat(48)))
})
test('aceita segredo JWT suficientemente longo', () => {
  const secret = 'xR1!lN7#kP9@qT2$zU5&bV8*wY3^cD6%'
  assert.equal(requireJwtSecret(secret), secret)
})
test('aceita somente JWT Bearer compacto', () => {
  assert.equal(readBearerJwt('Bearer aaaa.bbbb.cccc'), 'aaaa.bbbb.cccc')
  assert.equal(readBearerJwt('Basic aaaa.bbbb.cccc'), null)
  assert.equal(readBearerJwt('Bearer abc'), null)
  assert.equal(readBearerJwt(null), null)
})
test('CORS local seguro quando nao configurado', () => {
  assert.deepEqual(resolveCorsOrigins(undefined, false), ['http://localhost:5173'])
})
test('CORS exige configuracao de producao', () => assert.throws(() => resolveCorsOrigins('', true)))
test('CORS recusa wildcard e caminhos', () => {
  assert.throws(() => resolveCorsOrigins('*', false))
  assert.throws(() => resolveCorsOrigins('https://exemplo.com/path', true))
})
test('CORS permite multiplas origens distintas', () => {
  assert.deepEqual(resolveCorsOrigins('https://app.example.com,https://admin.example.com', true), ['https://app.example.com', 'https://admin.example.com'])
})
test('limita cinco tentativas por IP e email', () => {
  const limiter = new LoginThrottleService()
  for (let i = 0; i < 5; i++) {
    limiter.assertAllowed('user@example.com', '127.0.0.1')
    limiter.registerFailure('user@example.com', '127.0.0.1')
  }
  assert.throws(() => limiter.assertAllowed('USER@example.com', '127.0.0.1'), (err: any) => err.getStatus?.() === 429)
  limiter.assertAllowed('other@example.com', '127.0.0.1')
  limiter.clear('user@example.com', '127.0.0.1')
  limiter.assertAllowed('user@example.com', '127.0.0.1')
})
