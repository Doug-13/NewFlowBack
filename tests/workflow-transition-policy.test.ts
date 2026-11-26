import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { BadRequestException, ConflictException } from '@nestjs/common'
import { authorizeWorkflowAction, chooseWorkflowTransition } from '../src/workflow-runtime/transition-policy'

const actions = [
  { action_key: 'approve', outcome: 'approved', is_active: true },
  { action_key: 'reject', outcome: 'rejected', is_active: true, requires_comment: true },
  { action_key: 'disabled', outcome: 'disabled', is_active: false },
]
const transitions = [
  { target_element_id: 'reject-task', outcome: 'rejected', order_index: 2, is_default: true },
  { target_element_id: 'approved-task', outcome: 'approved', order_index: 1 },
]

test('aprovação segue resultado definido no servidor, nunca o outcome do cliente', () => {
  const action = authorizeWorkflowAction(actions, { actionId: 'approve', outcome: 'rejected' })
  assert.equal(action.outcome, 'approved')
  assert.equal(chooseWorkflowTransition(transitions, action.outcome).target_element_id, 'approved-task')
})
test('reprovação exige comentário', () => {
  assert.throws(() => authorizeWorkflowAction(actions, { actionId: 'reject' }), BadRequestException)
  assert.equal(authorizeWorkflowAction(actions, { actionId: 'reject', comment: 'Corrigir documento' }).outcome, 'rejected')
})
test('ação desativada e ação inexistente são rejeitadas', () => {
  assert.throws(() => authorizeWorkflowAction(actions, { actionId: 'disabled' }), BadRequestException)
  assert.throws(() => authorizeWorkflowAction(actions, { actionId: 'hack' }), BadRequestException)
})
test('outcome informado não cai silenciosamente no caminho padrão', () => {
  assert.throws(() => chooseWorkflowTransition(transitions, 'undefined'), ConflictException)
})
test('sem outcome, segue um único caminho padrão', () => {
  assert.equal(chooseWorkflowTransition(transitions, null).target_element_id, 'reject-task')
})
test('transições ambíguas ou inexistentes são rejeitadas', () => {
  assert.throws(() => chooseWorkflowTransition([], null), ConflictException)
  assert.throws(() => chooseWorkflowTransition([{ target_element_id: 'a' }, { target_element_id: 'b' }], null), ConflictException)
  assert.throws(() => chooseWorkflowTransition([{ target_element_id: 'a', outcome: 'yes' }, { target_element_id: 'b', outcome: 'yes' }], 'yes'), ConflictException)
})
test('destino explícito precisa pertencer ao grafo e ao resultado', () => {
  assert.equal(chooseWorkflowTransition(transitions, 'approved', 'approved-task').target_element_id, 'approved-task')
  assert.throws(() => chooseWorkflowTransition(transitions, 'approved', 'reject-task'), ConflictException)
})
