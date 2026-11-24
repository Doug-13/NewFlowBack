export type CodePart = {
  type: 'fixed' | 'metadata' | 'year' | 'unit' | 'area' | 'process' | 'sequential'
  fixedValue?: string
  metadataDefinitionId?: string
  separatorAfter?: string
}
export type NumberingSettings = {
  codingRule?: { parts?: CodePart[] }
  sequential?: { startAt?: number; digits?: number; resetPeriod?: 'never' | 'yearly' | 'monthly' }
}

export function safeSegment(value: unknown): string {
  const raw = typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  return raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

export function normalizeNumbering(settings: NumberingSettings | undefined) {
  const startAt = Number(settings?.sequential?.startAt ?? 1)
  const digits = Number(settings?.sequential?.digits ?? 3)
  const resetPeriod = settings?.sequential?.resetPeriod ?? 'never'
  if (!Number.isSafeInteger(startAt) || startAt < 0 || startAt > 99999999) throw new Error('Início do sequencial inválido.')
  if (!Number.isSafeInteger(digits) || digits < 1 || digits > 12) throw new Error('Quantidade de dígitos inválida.')
  if (!['never', 'yearly', 'monthly'].includes(resetPeriod)) throw new Error('Período de reinício inválido.')
  return { startAt, digits, resetPeriod }
}

export function renderCodePrefix(
  parts: CodePart[],
  context: { processCode: string; area?: string; unit?: string; metadata?: Record<string, unknown>; date?: Date },
): { before: string; after: string; sequencePresent: boolean } {
  let before = '', after = '', sequencePresent = false
  const now = context.date ?? new Date()
  for (const part of parts) {
    if (part.type === 'sequential') {
      if (sequencePresent) throw new Error('A regra de código possui mais de um sequencial.')
      sequencePresent = true
      continue
    }
    let segment = ''
    if (part.type === 'fixed') segment = safeSegment(part.fixedValue)
    else if (part.type === 'process') segment = safeSegment(context.processCode)
    else if (part.type === 'year') segment = String(now.getUTCFullYear())
    else if (part.type === 'area') segment = safeSegment(context.area)
    else if (part.type === 'unit') segment = safeSegment(context.unit)
    else if (part.type === 'metadata') segment = safeSegment(context.metadata?.[part.metadataDefinitionId ?? ''])
    if (!segment) throw new Error(`Componente obrigatório do código sem valor: ${part.type}.`)
    const separator = part.separatorAfter ?? ''
    if (!/^[\w-]{0,8}$/.test(separator)) throw new Error('Separador de código inválido.')
    if (!sequencePresent) before += segment + separator
    else after += segment + separator
  }
  if (!sequencePresent) throw new Error('Inclua um componente Sequencial na regra de codificação.')
  return { before, after, sequencePresent }
}

export function nextSequence(existing: string[], before: string, after: string, startAt: number, digits: number): string {
  let maximum = startAt - 1
  for (const code of existing) {
    if (!code.startsWith(before) || !code.endsWith(after)) continue
    const middle = code.slice(before.length, after ? -after.length : undefined)
    if (!/^\d+$/.test(middle)) continue
    const n = Number(middle)
    if (Number.isSafeInteger(n)) maximum = Math.max(maximum, n)
  }
  const next = maximum + 1
  if (!Number.isSafeInteger(next) || String(next).length > digits) throw new Error('Sequencial esgotado: aumente os dígitos.')
  return before + String(next).padStart(digits, '0') + after
}
