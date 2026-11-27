import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPublicIPv4, parseHttpAutomation, validateHttpDestination } from '../src/workflow-automation/workflow-http-policy'

test('3D: only exact allowlisted HTTPS domains', () => {
  assert.equal(validateHttpDestination('https://api.example.com/hook', 'api.example.com').hostname, 'api.example.com')
  for (const url of ['http://api.example.com', 'https://api.example.com:8443', 'https://evil.example.com',
    'https://api.example.com.evil.net', 'https://user:pass@api.example.com', 'https://127.0.0.1']) {
    assert.throws(() => validateHttpDestination(url, 'api.example.com'))
  }
})
test('3D: rejects private and reserved IPv4 targets', () => {
  for (const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.169.254',
    '100.64.1.1','198.18.1.1','192.0.2.1','198.51.100.1','203.0.113.5','0.0.0.0','224.0.0.1','::1']) {
    assert.equal(isPublicIPv4(ip), false, ip)
  }
  assert.equal(isPublicIPv4('8.8.8.8'), true)
  assert.equal(isPublicIPv4('1.1.1.1'), true)
})
test('3D: only admin configured serviceTask with valid secret env key', () => {
  const old = process.env.NEWFLOW_HTTP_ALLOWED_HOSTS
  process.env.NEWFLOW_HTTP_ALLOWED_HOSTS = 'api.example.com'
  try {
    const config = { automation: { enabled:true, type:'http', http:{url:'https://api.example.com/hook',method:'POST',secretEnv:'NEWFLOW_HTTP_SECRET_TEST'} } }
    assert.equal(parseHttpAutomation({ element_kind:'serviceTask', config })?.method, 'POST')
    assert.equal(parseHttpAutomation({ element_kind:'userTask', config }), null)
    assert.equal(parseHttpAutomation({ element_kind:'serviceTask', config:{ automation:{ enabled:true,type:'javascript' } } }), null)
    assert.equal(parseHttpAutomation({ element_kind:'serviceTask', config:{ automation:{ enabled:true,type:'http',http:{url:'http://api.example.com',method:'POST'} } } }), null)
    assert.equal(parseHttpAutomation({ element_kind:'serviceTask', config:{ automation:{ enabled:true,type:'http',http:{url:'https://api.example.com',method:'POST',secretEnv:'DATABASE_URL'} } } }), null)
  } finally {
    if (old === undefined) delete process.env.NEWFLOW_HTTP_ALLOWED_HOSTS
    else process.env.NEWFLOW_HTTP_ALLOWED_HOSTS = old
  }
})
