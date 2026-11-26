import { ConflictException } from '@nestjs/common'

export type GatewayElement = { element_id: string; element_kind?: string | null; element_type?: string | null }
export type GatewayFlow = {
  source_element_id: string
  target_element_id: string
  outcome?: string | null
  is_default?: boolean | null
  condition_type?: string | null
  order_index?: number | null
}

export type GatewayResolution = { kind: 'exclusive'; targetElementId: string }
  | { kind: 'parallel' | 'inclusive'; targetElementIds: string[]; requiresTokenRuntime: true }

function gatewayKind(element: GatewayElement): 'exclusive' | 'parallel' | 'inclusive' | null {
  const label = `${element.element_kind ?? ''} ${element.element_type ?? ''}`.toLowerCase()
  if (label.includes('exclusivegateway')) return 'exclusive'
  if (label.includes('parallelgateway')) return 'parallel'
  if (label.includes('inclusivegateway')) return 'inclusive'
  return null
}

/**
 * Resolves outgoing gateway paths from the stored graph, never from a request-supplied target.
 * AND/OR return a plan only; the caller MUST NOT advance a single current_element_id to one
 * of several branches. It must persist independent execution tokens first.
 */
export function planGateway(
  gateway: GatewayElement,
  outgoing: GatewayFlow[],
  outcome: string | null,
): GatewayResolution | null {
  const kind = gatewayKind(gateway)
  if (!kind) return null
  const flows = outgoing.filter(t => t.source_element_id === gateway.element_id)
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  if (!flows.length) throw new ConflictException('Gateway não possui caminhos de saída.')
  if (flows.some(t => !t.target_element_id)) throw new ConflictException('Gateway contém destino inválido.')
  if (kind === 'exclusive') {
    const matches = outcome ? flows.filter(t => t.outcome === outcome) : []
    if (matches.length > 1) throw new ConflictException('Gateway exclusivo possui caminhos ambíguos.')
    if (matches.length === 1) return { kind, targetElementId: matches[0].target_element_id }
    const defaults = flows.filter(t => t.is_default === true)
    if (defaults.length > 1) throw new ConflictException('Gateway exclusivo possui mais de um caminho padrão.')
    if (defaults.length === 1) return { kind, targetElementId: defaults[0].target_element_id }
    if (flows.length === 1 && !outcome) return { kind, targetElementId: flows[0].target_element_id }
    throw new ConflictException('Gateway exclusivo sem caminho válido para o resultado.')
  }
  if (kind === 'parallel') {
    return { kind, targetElementIds: flows.map(t => t.target_element_id), requiresTokenRuntime: true }
  }
  // Inclusive OR needs an explicit server-evaluated condition for each branch. Never use
  // arbitrary JavaScript expressions or implicit client-provided booleans.
  const selected = flows.filter(t => outcome && t.outcome === outcome)
  const defaults = flows.filter(t => t.is_default === true)
  const chosen = selected.length ? selected : defaults
  if (!chosen.length) throw new ConflictException('Gateway inclusivo sem condições resolvidas.')
  return { kind, targetElementIds: chosen.map(t => t.target_element_id), requiresTokenRuntime: true }
}

/** A gateway requiring tokens must never silently collapse to a single active step. */
export function requireSingleTokenGateway(resolution: GatewayResolution): string {
  if (resolution.kind !== 'exclusive') {
    throw new ConflictException('Gateway paralelo/inclusivo exige motor de tokens persistentes.')
  }
  return resolution.targetElementId
}
