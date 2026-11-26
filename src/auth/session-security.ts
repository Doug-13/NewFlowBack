import { createHash, randomUUID } from 'node:crypto'

export const SESSION_DURATION_MS = 2 * 60 * 60 * 1000

export function newSessionId(): string {
  return randomUUID()
}

export function tokenFingerprint(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function isValidSessionId(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
