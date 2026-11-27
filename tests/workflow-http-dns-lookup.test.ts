import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPinnedLookup } from '../src/workflow-automation/workflow-http-client'

test('3D DNS: lookup com all=true devolve array para Node autoSelectFamily', () => {
  const ip = '8.8.8.8'
  let args: unknown[] | undefined
  createPinnedLookup(ip)('api.example.test', { all: true }, (...values) => { args = values })
  assert.deepEqual(args, [null, [{ address: ip, family: 4 }]])
})

test('3D DNS: lookup tradicional devolve ip e family', () => {
  const ip = '8.8.4.4'
  let args: unknown[] | undefined
  createPinnedLookup(ip)('api.example.test', { all: false }, (...values) => { args = values })
  assert.deepEqual(args, [null, ip, 4])
})
