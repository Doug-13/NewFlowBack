import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ConflictException } from '@nestjs/common'
import { validateLinearAndBranches } from '../src/workflow-runtime/branch-path-policy'

const elements = [
  { element_id: 'a1', element_kind: 'userTask' },
  { element_id: 'a2', element_kind: 'userTask' },
  { element_id: 'b1', element_kind: 'userTask' },
  { element_id: 'b2', element_kind: 'userTask' },
  { element_id: 'join', element_kind: 'parallelGateway' },
]
const transitions = [
  { source_element_id: 'a1', target_element_id: 'a2' },
  { source_element_id: 'a2', target_element_id: 'join' },
  { source_element_id: 'b1', target_element_id: 'b2' },
  { source_element_id: 'b2', target_element_id: 'join' },
]

test('2H: AND permite multiplas atividades lineares por ramo', () => {
  const paths = validateLinearAndBranches(['a1', 'b1'], 'join', elements, transitions)
  assert.deepEqual(paths.get('a1'), ['a1', 'a2'])
  assert.deepEqual(paths.get('b1'), ['b1', 'b2'])
})

test('2H: AND preserva suporte a ramo com uma unica atividade', () => {
  const paths = validateLinearAndBranches(['a2', 'b2'], 'join', elements, transitions)
  assert.deepEqual(paths.get('a2'), ['a2'])
})

test('2H: AND rejeita ciclo', () => {
  const graph = transitions.map(t => ({ ...t }))
  graph[1].target_element_id = 'a1'
  assert.throws(() => validateLinearAndBranches(['a1', 'b1'], 'join', elements, graph), ConflictException)
})

test('2H: AND rejeita fusao antes do join', () => {
  const graph = transitions.map(t => ({ ...t }))
  graph[2].target_element_id = 'a2'
  assert.throws(() => validateLinearAndBranches(['a1', 'b1'], 'join', elements, graph), ConflictException)
})

test('2H: AND rejeita bifurcacao interna', () => {
  const graph = [...transitions, { source_element_id: 'a1', target_element_id: 'join' }]
  assert.throws(() => validateLinearAndBranches(['a1', 'b1'], 'join', elements, graph), ConflictException)
})

test('2H: AND rejeita gateway aninhado', () => {
  const graph = elements.map(e => e.element_id === 'a2' ? { ...e, element_kind: 'exclusiveGateway' } : e)
  assert.throws(() => validateLinearAndBranches(['a1', 'b1'], 'join', graph, transitions), ConflictException)
})

test('2H: AND rejeita caminho inexistente e join invalido', () => {
  assert.throws(() => validateLinearAndBranches(['a1', 'missing'], 'join', elements, transitions), ConflictException)
  assert.throws(() => validateLinearAndBranches(['a1', 'b1'], 'a2', elements, transitions), ConflictException)
})
