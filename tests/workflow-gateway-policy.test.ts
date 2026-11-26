import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { ConflictException } from '@nestjs/common'
import { planGateway, requireSingleTokenGateway } from '../src/workflow-runtime/gateway-policy'

const xor = { element_id: 'gw', element_kind: 'exclusiveGateway' }
const and = { element_id: 'gw', element_kind: 'parallelGateway' }
const or = { element_id: 'gw', element_kind: 'inclusiveGateway' }
const flows = [
  { source_element_id: 'gw', target_element_id: 'approved', outcome: 'approved', order_index: 1 },
  { source_element_id: 'gw', target_element_id: 'rejected', outcome: 'rejected', order_index: 2 },
]

test('XOR escolhe o caminho com resultado configurado no servidor', () => {
  assert.deepEqual(planGateway(xor, flows, 'approved'), { kind: 'exclusive', targetElementId: 'approved' })
})
test('XOR rejeita resultado sem caminho nem default', () => {
  assert.throws(() => planGateway(xor, flows, 'unknown'), ConflictException)
})
test('XOR rejeita duas transicoes com mesmo outcome', () => {
  assert.throws(() => planGateway(xor, [...flows, { ...flows[0], target_element_id: 'other' }], 'approved'), ConflictException)
})
test('XOR segue um default unico, sem adivinhar', () => {
  assert.deepEqual(planGateway(xor, [{...flows[0], is_default: true }, flows[1]], null), { kind: 'exclusive', targetElementId: 'approved' })
})
test('AND planeja todos os caminhos, mas impede colapsar tokens', () => {
  const result = planGateway(and, flows, null)!
  assert.deepEqual(result, { kind: 'parallel', targetElementIds: ['approved', 'rejected'], requiresTokenRuntime: true })
  assert.throws(() => requireSingleTokenGateway(result), ConflictException)
})
test('OR planeja apenas caminhos com resultado correspondente', () => {
  const result = planGateway(or, [...flows, { ...flows[0], target_element_id: 'review' }], 'approved')!
  assert.deepEqual(result, { kind: 'inclusive', targetElementIds: ['approved', 'review'], requiresTokenRuntime: true })
  assert.throws(() => requireSingleTokenGateway(result), ConflictException)
})
test('gateway sem saida e bloqueado', () => {
  assert.throws(() => planGateway(and, [], null), ConflictException)
})
