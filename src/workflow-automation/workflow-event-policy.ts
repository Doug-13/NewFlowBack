export type EventType = 'message' | 'signal'
export type EventConfiguration = { enabled: true; type: EventType; name: string }

export function parseEventConfig(element: { element_kind?: string | null; config?: unknown } | null): EventConfiguration | null {
  if (!element || !/^(receiveTask|intermediateCatchEvent)$/i.test(element.element_kind ?? '')) return null
  const config = (element.config as any)?.eventTrigger
  if (!config || config.enabled !== true || !['message', 'signal'].includes(config.type)) return null
  if (typeof config.name !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_.:-]{0,79}$/.test(config.name)) return null
  return { enabled: true, type: config.type, name: config.name }
}
export function validatePublish(body: unknown): {
  type: EventType; name: string; key: string; documentId?: string; sourceDocumentId?: string
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Corpo invalido.')
  const b = body as Record<string, unknown>
  const keys = Object.keys(b)
  if (keys.some(k => !['type','name','key','documentId','sourceDocumentId'].includes(k))) throw new Error('Campos nao autorizados.')
  if (b.type !== 'message' && b.type !== 'signal') throw new Error('Tipo de evento invalido.')
  if (typeof b.name !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_.:-]{0,79}$/.test(b.name)) throw new Error('Nome de evento invalido.')
  if (typeof b.key !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(b.key)) throw new Error('Chave de idempotencia invalida.')
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
  for (const k of ['documentId','sourceDocumentId']) if (b[k] !== undefined && (typeof b[k] !== 'string' || !uuid.test(b[k] as string))) throw new Error(`${k} invalido.`)
  if (b.type === 'message' && !b.documentId) throw new Error('message exige documentId.')
  if (b.type === 'signal' && b.documentId) throw new Error('signal nao aceita documentId.')
  return { type: b.type, name: b.name, key: b.key, documentId: b.documentId as string | undefined, sourceDocumentId: b.sourceDocumentId as string | undefined }
}
