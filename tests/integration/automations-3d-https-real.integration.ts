/**
 * Phase 3D: actual TLS egress using the production WorkflowHttpClient.
 * No Prisma connection, no business documents and no worker.
 * Third-party Postman Echo receives only synthetic test data.
 * Run only through scripts/Executar-Homologacao-HTTPS-3D.ps1 with consent.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { WorkflowHttpClient } from '../../src/workflow-automation/workflow-http-client'
import { isPublicIPv4, validateHttpDestination } from '../../src/workflow-automation/workflow-http-policy'

if (process.env.NEWFLOW_3D_LIVE_TEST_CONSENT !== 'TESTARHTTPS') {
  throw new Error('Homologacao HTTPS externa exige confirmacao TESTARHTTPS pelo runner.')
}

// Process-level flags here do not enable the worker or persist in .env.
process.env.NEWFLOW_HTTP_ENABLED = 'true'
process.env.NEWFLOW_HTTP_ALLOWED_HOSTS = 'postman-echo.com'
delete process.env.NEWFLOW_HTTP_SECRET_HOMOLOGACAO

const client = new WorkflowHttpClient()
const unique = randomUUID()
const documentId = randomUUID()
const url = (path: string) => `https://postman-echo.com${path}`

console.log('HTTPS real: Postman Echo; dados 100% ficticios; worker desativado; sem banco Neon.')

test('1/8 HTTPS GET real, TLS e allowlist', async () => {
  assert.equal(await client.send({ url: url('/get'), method: 'GET' }, `nf-3d-get-${unique}`, documentId), 200)
})

test('2/8 HTTPS POST real com payload sintetico', async () => {
  assert.equal(await client.send({ url: url('/post'), method: 'POST', body: { teste: 'NewFlow3D', ficticio: true } }, `nf-3d-post-${unique}`, documentId), 200)
})

test('3/8 HTTPS PATCH real com payload sintetico', async () => {
  assert.equal(await client.send({ url: url('/patch'), method: 'PATCH', body: { teste: 'NewFlow3D', ficticio: true } }, `nf-3d-patch-${unique}`, documentId), 200)
})

test('4/8 HTTP 404 real rejeitado, sem sucesso falso', async () => {
  await assert.rejects(client.send({ url: url('/status/404'), method: 'GET' }, `nf-3d-404-${unique}`, documentId), /HTTP 404/)
})

test('5/8 Redirecionamento 302 real NAO seguido', async () => {
  await assert.rejects(client.send({ url: url('/status/302'), method: 'GET' }, `nf-3d-302-${unique}`, documentId), /HTTP 302/)
})

test('6/8 SSRF e URLs nao autorizadas bloqueadas antes do envio', async () => {
  for (const bad of ['http://postman-echo.com/get', 'https://127.0.0.1/get', 'https://localhost/get', 'https://example.com/get', 'https://postman-echo.com:8443/get']) {
    assert.throws(() => validateHttpDestination(bad, 'postman-echo.com'))
  }
  for (const ip of ['10.1.1.1', '127.0.0.1', '169.254.169.254', '172.20.1.1', '192.168.0.10', '100.64.0.1', '198.51.100.1']) {
    assert.equal(isPublicIPv4(ip), false, `IP perigoso permitido: ${ip}`)
  }
})

test('7/8 Credencial ausente gera erro antes de abrir HTTPS', async () => {
  await assert.rejects(client.send({ url: url('/get'), method: 'GET', secretEnv: 'NEWFLOW_HTTP_SECRET_HOMOLOGACAO' }, `nf-3d-secret-${unique}`, documentId), /Credencial de integracao nao configurada/)
})

test('8/8 Flag de desativacao bloqueia o cliente', async () => {
  process.env.NEWFLOW_HTTP_ENABLED = 'false'
  try {
    await assert.rejects(client.send({ url: url('/get'), method: 'GET' }, `nf-3d-off-${unique}`, documentId), /Integracoes HTTP desativadas/)
  } finally {
    process.env.NEWFLOW_HTTP_ENABLED = 'true'
  }
})
