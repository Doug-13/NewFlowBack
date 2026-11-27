import { BadRequestException } from '@nestjs/common'

type AnyElement = { element_kind?: string | null; config?: unknown }
export type ScheduleKind = 'timer' | 'deadline' | 'escalation'
export type SchedulePlan = { kind: ScheduleKind; availableAt: Date }

function configOf(element: AnyElement): Record<string, any> {
  return element.config && typeof element.config === 'object' && !Array.isArray(element.config)
    ? element.config as Record<string, any> : {}
}
function integer(value: unknown, min: number, max: number, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new BadRequestException(`${field} deve ser um numero inteiro entre ${min} e ${max}.`)
  }
  return value as number
}
export function timerSeconds(element: AnyElement): number | null {
  if (!/^(intermediateCatchEvent|timerEvent)$/i.test(element.element_kind ?? '')) return null
  const timer = configOf(element).timer
  if (!timer || timer.enabled !== true) return null
  return integer(timer.delaySeconds, 0, 2592000, 'timer.delaySeconds')
}
export function deadlineRules(element: AnyElement): { minutes: number; escalateAfterMinutes: number | null; escalateToUserId: string | null } | null {
  if (!/^(userTask|manualTask)$/i.test(element.element_kind ?? '')) return null
  const deadline = configOf(element).deadline
  if (!deadline || deadline.enabled !== true) return null
  const minutes = integer(deadline.minutes, 1, 525600, 'deadline.minutes')
  const escalate = deadline.escalateAfterMinutes == null ? null : integer(deadline.escalateAfterMinutes, 0, 10080, 'deadline.escalateAfterMinutes')
  const recipient = typeof deadline.escalateToUserId === 'string' ? deadline.escalateToUserId.trim() : null
  return { minutes, escalateAfterMinutes: escalate !== null && recipient ? escalate : null, escalateToUserId: recipient || null }
}
/** The timestamp is captured when the document enters its stage; the first job is persisted and never rescheduled on repeat scans. */
export function planSchedules(element: AnyElement, enteredAt: Date | string): SchedulePlan[] {
  const baseline = new Date(enteredAt).getTime()
  if (!Number.isFinite(baseline)) throw new BadRequestException('Data de entrada na atividade invalida.')
  const seconds = timerSeconds(element)
  if (seconds !== null) return [{ kind: 'timer', availableAt: new Date(baseline + seconds * 1000) }]
  const rules = deadlineRules(element)
  if (!rules) return []
  const due = baseline + rules.minutes * 60000
  return [
    { kind: 'deadline', availableAt: new Date(due) },
    ...(rules.escalateAfterMinutes !== null ? [{ kind: 'escalation' as const, availableAt: new Date(due + rules.escalateAfterMinutes * 60000) }] : []),
  ]
}
