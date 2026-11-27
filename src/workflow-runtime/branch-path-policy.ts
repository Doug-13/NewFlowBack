import { ConflictException } from '@nestjs/common'

type Element = { element_id: string; element_kind?: string | null; is_end?: boolean | null }
type Transition = { source_element_id: string; target_element_id: string }

/**
 * Validate a conservative AND shape: two or more disjoint, linear chains
 * of user activities, all ending at the same parallel join. This policy does
 * not accept implicit branching, cycles, gateway nesting or early merges.
 * Returns branch activity IDs in execution order (the join is not included).
 */
export function validateLinearTokenBranches(
  starts: readonly string[],
  joinElementId: string,
  elements: readonly Element[],
  transitions: readonly Transition[],
  kind: 'parallel' | 'inclusive',
): Map<string, string[]> {
  const minimum = kind === 'parallel' ? 2 : 1
  if (!joinElementId || starts.length < minimum || new Set(starts).size !== starts.length || starts.some(x => !x)) {
    throw new ConflictException('Gateway exige caminhos distintos e um join valido.')
  }
  const byId = new Map(elements.map(e => [e.element_id, e]))
  const join = byId.get(joinElementId)
  if (!join || !(kind === 'parallel' ? /parallelgateway/i : /inclusivegateway/i).test(join.element_kind ?? '')) {
    throw new ConflictException('Join nao corresponde ao tipo de fork.')
  }
  const paths = new Map<string, string[]>()
  const globallyVisited = new Set<string>()
  for (const start of starts) {
    let id = start
    const path: string[] = []
    const locallyVisited = new Set<string>()
    while (id !== joinElementId) {
      if (locallyVisited.has(id)) throw new ConflictException('Ciclo detectado em ramo AND.')
      if (globallyVisited.has(id)) throw new ConflictException('Ramos AND nao podem se cruzar antes do join.')
      locallyVisited.add(id)
      globallyVisited.add(id)
      const element = byId.get(id)
      if (!element || /gateway|event/i.test(element.element_kind ?? '') || element.is_end) {
        throw new ConflictException('Ramo AND possui destino ausente, gateway aninhado ou evento intermediario.')
      }
      path.push(id)
      if (path.length > elements.length) throw new ConflictException('Ciclo ou grafo AND invalido.')
      const outgoing = transitions.filter(t => t.source_element_id === id)
      if (outgoing.length !== 1 || !outgoing[0].target_element_id) {
        throw new ConflictException('Ramo AND exige exatamente uma saida por atividade.')
      }
      id = outgoing[0].target_element_id
    }
    paths.set(start, path)
  }
  return paths
}

/** Compatibility function for existing AND validators and tests. */
export function validateLinearAndBranches(
  starts: readonly string[],
  joinElementId: string,
  elements: readonly Element[],
  transitions: readonly Transition[],
): Map<string, string[]> {
  return validateLinearTokenBranches(starts, joinElementId, elements, transitions, 'parallel')
}
