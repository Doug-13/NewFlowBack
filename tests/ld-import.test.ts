import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { excelColumnIndex, inspectRow } from '../src/ld-import/ld-import.service'
const m = [
  { column: 'A', metadataDefinitionId: 'x', required: true },
  { column: 'C', metadataDefinitionId: 'z', required: false },
]
test('colunas A, Z, AA, AB', () => { assert.equal(excelColumnIndex('A'),1); assert.equal(excelColumnIndex('Z'),26); assert.equal(excelColumnIndex('AA'),27); assert.equal(excelColumnIndex('AB'),28) })
test('rejeita coluna inválida', () => assert.throws(() => excelColumnIndex('A1')))
test('extrai metadados por posição e preserva linha', () => {
  const row = inspectRow(4,['Título','ignorar','Engenharia'],m,{x:'Nome',z:'Área'})
  assert.equal(row?.row,4); assert.equal(row?.metadata.z,'Engenharia'); assert.equal(row?.title,'Título')
})
test('identifica metadado obrigatório ausente', () => {
  const row=inspectRow(5,['','','Engenharia'],m,{x:'Nome',z:'Área'})
  assert.match(row?.errors[0] ?? '',/Nome/)
})
test('ignora linha vazia', () => assert.equal(inspectRow(7,['','',''],m,{}),null))
