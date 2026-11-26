import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeBranches, decideParallelJoin, selectInclusiveBranches, canResumeParent } from '../src/workflow-runtime/token-coordination-policy'

const tokens = [
  { branchKey: 'quality', elementId: 'task1', status: 'arrived' as const, forkKey: 'fork1', joinElementId: 'join1' },
  { branchKey: 'engineering', elementId: 'task2', status: 'active' as const, forkKey: 'fork1', joinElementId: 'join1' },
]
test('fork exige ao menos um ramo e ramos unicos', () => {
  assert.deepEqual(normalizeBranches([' a ', 'b']), ['a','b'])
  assert.throws(() => normalizeBranches([]))
  assert.throws(() => normalizeBranches(['a','a']))
  assert.throws(() => normalizeBranches(['']))
})
test('AND nao libera antes de todos chegarem', () => {
  assert.deepEqual(decideParallelJoin(tokens, 'fork1', 'join1'), {ready:false,arrived:1,expected:2})
})
test('AND libera apenas com todos os tokens chegados', () => {
  assert.equal(decideParallelJoin(tokens.map(x=>({...x,status:'arrived' as const})), 'fork1','join1').ready,true)
})
test('join rejeita tokens de gateways diferentes', () => {
  assert.throws(()=>decideParallelJoin([...tokens.slice(0,1), {...tokens[1],joinElementId:'other'}], 'fork1','join1'))
})
test('join rejeita tokens duplicados', () => {
  assert.throws(()=>decideParallelJoin([tokens[0], tokens[0]], 'fork1','join1'))
})
test('OR seleciona somente os ramos do resultado', () => {
  assert.deepEqual(selectInclusiveBranches([{branchKey:'a',outcome:'approve',isDefault:false},{branchKey:'b',outcome:'approve',isDefault:false},{branchKey:'c',outcome:null,isDefault:true}], 'approve'), ['a','b'])
})
test('OR adota caminho padrao quando nao ha resultado', () => {
  assert.deepEqual(selectInclusiveBranches([{branchKey:'c',outcome:null,isDefault:true}],null), ['c'])
})
test('OR rejeita sem caminho resolvido', () => {
  assert.throws(()=>selectInclusiveBranches([{branchKey:'a',outcome:'approve',isDefault:false}], 'reject'))
})
test('pai nao retoma enquanto filho obrigatorio estiver pendente', () => {
  assert.equal(canResumeParent([{required:true,status:'created'}],true),false)
})
test('pai exige token no elemento de espera', () => {
  assert.equal(canResumeParent([{required:true,status:'completed'}],false),false)
})
test('pai retoma quando filhos obrigatorios concluidos', () => {
  assert.equal(canResumeParent([{required:true,status:'completed'},{required:true,status:'published'},{required:false,status:'created'}],true),true)
})
test('pai sem filhos aguardados nao e retomado automaticamente', () => {
  assert.equal(canResumeParent([],true),false)
})
