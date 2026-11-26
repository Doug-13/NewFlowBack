import { ForbiddenException } from '@nestjs/common'

export type AssignmentRule = {
  userIds: string[]
  groupIds: string[]
  roleIds: string[]
  areaIds: string[]
}

export type AssignmentIdentity = {
  id: string
  groupIds?: string[]
  roleIds?: string[]
  areaIds?: string[]
}

/** Fail closed when the step has explicit assignees. No client-provided identities are trusted. */
export function assertActivityAssignee(
  rule: AssignmentRule,
  identity: AssignmentIdentity,
  explicitlyAssignedUserId?: string | null,
): void {
  if (explicitlyAssignedUserId) {
    if (explicitlyAssignedUserId !== identity.id) {
      throw new ForbiddenException('Atividade atribuída a outro usuário.')
    }
    return
  }
  const configured = rule.userIds.length + rule.groupIds.length + rule.roleIds.length + rule.areaIds.length
  if (!configured) {
    throw new ForbiddenException('Atividade sem responsável definido.')
  }
  const eligible = rule.userIds.includes(identity.id)
    || rule.groupIds.some(id => (identity.groupIds ?? []).includes(id))
    || rule.roleIds.some(id => (identity.roleIds ?? []).includes(id))
    || rule.areaIds.some(id => (identity.areaIds ?? []).includes(id))
  if (!eligible) throw new ForbiddenException('Usuário não autorizado nesta atividade.')
}
