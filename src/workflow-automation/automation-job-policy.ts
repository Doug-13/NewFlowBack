/** Stable one-shot key; the supported BPMN core does not permit loops/repeating the same element. */
export function automationJobKey(documentId: string, elementId: string, tokenId?: string | null): string {
  if (!documentId || !elementId) throw new Error('Identificadores de automacao obrigatorios.')
  return `${documentId}:${tokenId || 'document'}:${elementId}`
}

export function isNoopAutomation(element: { element_kind?: string | null; config?: unknown } | null): boolean {
  if (!element || !/^serviceTask$/i.test(element.element_kind ?? '')) return false
  const value = (element.config as any)?.automation
  return value?.enabled === true && value?.type === 'noop'
}

export function retryDelayMs(attempt: number): number {
  if (!Number.isSafeInteger(attempt) || attempt < 1) throw new Error('Tentativa invalida.')
  return Math.min(300000, 5000 * (2 ** Math.min(attempt - 1, 10)))
}

export function failureDisposition(attempt: number, maxAttempts: number): 'retry' | 'dead' {
  return attempt >= maxAttempts ? 'dead' : 'retry'
}
