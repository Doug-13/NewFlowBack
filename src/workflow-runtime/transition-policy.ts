import { BadRequestException, ConflictException } from '@nestjs/common'

export type TransitionRecord = {
  id?: string
  outcome?: string | null
  is_default?: boolean | null
  order_index?: number | null
  target_element_id: string
}
export type ActionRecord = {
  action_key: string
  outcome?: string | null
  is_active?: boolean | null
  requires_comment?: boolean | null
  next_element_id?: string | null
}

/** User-supplied outcome is never authoritative when actions are configured. */
export function authorizeWorkflowAction(
  actions: ActionRecord[],
  request: { actionId?: unknown; action?: unknown; outcome?: unknown; comment?: unknown },
): { actionKey: string; outcome: string | null; targetId: string | null } {
  const requested = String(request.actionId ?? request.action ?? '').trim()
  if (!requested) throw new BadRequestException('Informe a ação da atividade.')
  if (!actions.length) {
    return { actionKey: requested, outcome: typeof request.outcome === 'string' ? request.outcome : null, targetId: null }
  }
  const action = actions.find(item => item.action_key === requested && item.is_active !== false)
  if (!action) throw new BadRequestException('Ação não permitida nesta atividade.')
  if (action.requires_comment && !String(request.comment ?? '').trim()) {
    throw new BadRequestException('Esta ação exige comentário.')
  }
  return { actionKey: action.action_key, outcome: action.outcome ?? null, targetId: action.next_element_id ?? null }
}

/** Do not silently take an approval's default/rejection route. */
export function chooseWorkflowTransition(
  transitions: TransitionRecord[],
  outcome: string | null,
  targetId: string | null = null,
): TransitionRecord {
  const ordered = [...transitions].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  if (targetId) {
    const targeted = ordered.find(item => item.target_element_id === targetId && (!outcome || item.outcome === outcome))
    if (!targeted) throw new ConflictException('Destino configurado não corresponde a uma transição válida.')
    return targeted
  }
  if (outcome) {
    const matching = ordered.filter(item => item.outcome === outcome)
    if (matching.length !== 1) throw new ConflictException('Resultado sem uma transição única e válida.')
    return matching[0]
  }
  const defaults = ordered.filter(item => item.is_default === true)
  if (defaults.length === 1) return defaults[0]
  if (defaults.length > 1) throw new ConflictException('Workflow possui mais de uma transição padrão.')
  if (ordered.length === 1) return ordered[0]
  throw new ConflictException('Não existe uma transição inequívoca para esta atividade.')
}
