import test from 'node:test'
import assert from 'node:assert/strict'
import { BadRequestException } from '@nestjs/common'
import { normalizeGrdRules, grdReady } from '../src/grd/grd.service'

test('regras padrao permitem documentos novos e existentes', () => { const r = normalizeGrdRules({}); assert.equal(r.allowExistingDocuments, true); assert.equal(r.allowNewDocuments, true) })
test('impede configurar duas formas de inclusao desativadas', () => assert.throws(() => normalizeGrdRules({ allowNewDocuments: false, allowExistingDocuments: false }), BadRequestException))
test('rejeita quantidade minima invalida', () => assert.throws(() => normalizeGrdRules({ minimumDocuments: 0 }), BadRequestException))
test('bloqueia avanço sem minimo requerido', () => assert.equal(grdReady(1, normalizeGrdRules({ minimumDocuments: 2 })), false))
test('libera avanço com minimo atendido', () => assert.equal(grdReady(2, normalizeGrdRules({ minimumDocuments: 2 })), true))
test('quantidade opcional permite GRD sem documentos', () => assert.equal(grdReady(0, normalizeGrdRules({ requireDocuments: false })), true))
