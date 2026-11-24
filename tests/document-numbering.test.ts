import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextSequence, normalizeNumbering, renderCodePrefix, safeSegment } from '../src/document-numbering/numbering-rules'

test('normaliza componentes de código', () => {
  assert.equal(safeSegment('Engenharia Civil'), 'ENGENHARIA-CIVIL')
  assert.equal(safeSegment('Qualidade / Inspeção'), 'QUALIDADE-INSPECAO')
})
test('gera sequencial com padding por prefixo', () => {
  assert.equal(nextSequence(['QUA-001', 'QUA-009', 'ENG-001'], 'QUA-', '', 1, 3), 'QUA-010')
})
test('ignora códigos de outros processos ou grupos', () => {
  assert.equal(nextSequence(['A-001-X','A-002-Y'], 'A-', '-X', 1, 3), 'A-002-X')
})
test('respeita o valor inicial', () => {
  assert.equal(nextSequence([], 'LD-', '', 100, 4), 'LD-0100')
})
test('impede sequencial acima do limite configurado', () => {
  assert.throws(() => nextSequence(['LD-99'], 'LD-', '', 1, 2), /esgotado/)
})
test('interpreta componentes do processo e metadados', () => {
  const r = renderCodePrefix([
    {type:'process',separatorAfter:'-'},
    {type:'metadata', metadataDefinitionId:'area',separatorAfter:'-'},
    {type:'sequential'},
  ], {processCode:'LD',metadata:{area:'QUAL'}})
  assert.equal(nextSequence([], r.before,r.after,1,3),'LD-QUAL-001')
})
test('rejeita metadado obrigatório ausente', () => {
  assert.throws(() => renderCodePrefix([{type:'metadata',metadataDefinitionId:'x'},{type:'sequential'}],{processCode:'LD'}), /sem valor/)
})
test('rejeita múltiplos sequenciais', () => {
  assert.throws(() => renderCodePrefix([{type:'sequential'},{type:'sequential'}],{processCode:'LD'}), /mais de um/)
})
test('valida os limites configurados', () => {
  assert.deepEqual(normalizeNumbering({sequential:{startAt:1,digits:3,resetPeriod:'never'}}), {startAt:1,digits:3,resetPeriod:'never'})
  assert.throws(() => normalizeNumbering({sequential:{startAt:1,digits:0}}), /inválida/)
})
