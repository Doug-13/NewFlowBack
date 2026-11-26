/**
 * Pure decision layer for persisted BPMN branch tokens.
 * No client-supplied route or expression is executed here.
 * Database writes/locking must be implemented by the transaction runtime.
 */
export type Branch = {
  branchKey: string
  elementId: string
  status: 'active' | 'arrived' | 'completed' | 'cancelled'
  forkKey: string
  joinElementId: string
}
export type JoinDecision = { ready: boolean; arrived: number; expected: number }

export function normalizeBranches(branches: readonly string[]): string[] {
  const result = branches.map(x => x.trim())
  if (!result.length || result.some(x => !x) || new Set(result).size !== result.length) {
    throw new Error('Caminhos BPMN ausentes ou duplicados.')
  }
  return result
}

/** All fork branches must reach the same join before continuing. */
export function decideParallelJoin(tokens: readonly Branch[], forkKey: string, joinElementId: string): JoinDecision {
  const cohort = tokens.filter(t => t.forkKey === forkKey)
  if (!forkKey || !joinElementId || !cohort.length) throw new Error('Fork ou join BPMN invalido.')
  const keys = new Set<string>()
  for (const token of cohort) {
    if (!token.branchKey || keys.has(token.branchKey)) throw new Error('Token de ramificacao duplicado.')
    keys.add(token.branchKey)
    if (token.joinElementId !== joinElementId) throw new Error('Token associado a join diferente.')
  }
  const arrived = cohort.filter(t => t.status === 'arrived').length
  return { ready: arrived === cohort.length, arrived, expected: cohort.length }
}

/** Explicit server-evaluated matching only; never evaluate untrusted expression strings. */
export function selectInclusiveBranches(
  candidates: readonly { branchKey: string; outcome: string | null; isDefault: boolean }[],
  outcome: string | null,
): string[] {
  if (!candidates.length) throw new Error('Gateway inclusivo sem saidas.')
  const matched = outcome ? candidates.filter(c => c.outcome === outcome) : []
  const chosen = matched.length ? matched : candidates.filter(c => c.isDefault)
  return normalizeBranches(chosen.map(c => c.branchKey))
}

export function canResumeParent(waiting: readonly { required: boolean; status: string }[], parentAtWaitingElement: boolean): boolean {
  const required = waiting.filter(w => w.required)
  return parentAtWaitingElement && required.length > 0 && required.every(w => ['completed', 'published', 'archived'].includes(w.status))
}
