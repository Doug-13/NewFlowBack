import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseEventConfig, validatePublish } from '../src/workflow-automation/workflow-event-policy'
const doc = '00000000-0000-4000-8000-000000000001'
test('3C: somente tarefas de recepcao explicitamente configuradas',()=>{
  assert.deepEqual(parseEventConfig({element_kind:'receiveTask',config:{eventTrigger:{enabled:true,type:'message',name:'plano.acao'}}}),{enabled:true,type:'message',name:'plano.acao'})
  assert.equal(parseEventConfig({element_kind:'userTask',config:{eventTrigger:{enabled:true,type:'message',name:'plano.acao'}}}),null)
  assert.equal(parseEventConfig({element_kind:'receiveTask',config:{eventTrigger:{enabled:false,type:'signal',name:'ok'}}}),null)
  assert.equal(parseEventConfig({element_kind:'receiveTask',config:{eventTrigger:{enabled:true,type:'signal',name:'a b'}}}),null)
})
test('3C: mensagem exige destinatario',()=>{
  assert.throws(()=>validatePublish({type:'message',name:'plano.acao',key:'evento123'}))
  assert.equal(validatePublish({type:'message',name:'plano.acao',key:'evento123',documentId:doc}).documentId,doc)
})
test('3C: sinal nao aceita destinatario',()=>{
  assert.throws(()=>validatePublish({type:'signal',name:'plano.acao',key:'evento123',documentId:doc}))
  assert.equal(validatePublish({type:'signal',name:'plano.acao',key:'evento123'}).type,'signal')
})
test('3C: rejeita payload extra, scripts e chave curta',()=>{
  assert.throws(()=>validatePublish({type:'signal',name:'ok',key:'evento123',script:'x'}))
  assert.throws(()=>validatePublish({type:'signal',name:'ok',key:'a'}))
  assert.throws(()=>validatePublish({type:'signal',name:'https://unsafe.test',key:'evento123'}))
})
test('3C: origem deve ser UUID e nao pode carregar payload livre',()=>{
  assert.throws(()=>validatePublish({type:'signal',name:'ok',key:'evento123',sourceDocumentId:'123'}))
  assert.equal(validatePublish({type:'signal',name:'ok',key:'evento123',sourceDocumentId:doc}).sourceDocumentId,doc)
})
