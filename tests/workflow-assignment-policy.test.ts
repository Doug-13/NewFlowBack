import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { ForbiddenException } from '@nestjs/common'
import { assertActivityAssignee } from '../src/workflow-runtime/assignment-policy'
const rule = { userIds: ['u1'], groupIds: ['g1'], roleIds: ['r1'], areaIds: ['a1'] }
test('usuario explicitamente configurado pode executar', () => {
  assert.doesNotThrow(() => assertActivityAssignee(rule, {id: 'u1'}))
})
test('membro de grupo autorizado pode executar', () => {
  assert.doesNotThrow(() => assertActivityAssignee(rule, {id: 'u2', groupIds: ['g1']}))
})
test('cargo autorizado pode executar', () => {
  assert.doesNotThrow(() => assertActivityAssignee(rule, {id: 'u2', roleIds: ['r1']}))
})
test('area autorizada pode executar', () => {
  assert.doesNotThrow(() => assertActivityAssignee(rule, {id: 'u2', areaIds: ['a1']}))
})
test('usuario nao autorizado nao executa', () => {
  assert.throws(() => assertActivityAssignee(rule, {id: 'u3'}), ForbiddenException)
})
test('atribuicao nominal do documento prevalece sobre grupos', () => {
  assert.throws(() => assertActivityAssignee(rule, {id: 'u2', groupIds: ['g1']}, 'u1'), ForbiddenException)
})
test('atividade sem responsavel nega execucao', () => {
  assert.throws(() => assertActivityAssignee({userIds:[], groupIds:[], roleIds:[], areaIds:[]}, {id: 'u1'}), ForbiddenException)
})
