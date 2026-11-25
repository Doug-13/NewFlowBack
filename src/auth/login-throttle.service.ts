import { HttpException, Injectable } from '@nestjs/common'

type Entry = { failed: number; expiresAt: number }

/** In-memory abuse mitigation for single-instance development; use shared storage in a cluster. */
@Injectable()
export class LoginThrottleService {
  private readonly attempts = new Map<string, Entry>()
  private readonly windowMs = 15 * 60 * 1000
  private readonly maxFailures = 5
  private readonly maxKeys = 10_000

  private key(email: string, ip: string): string {
    return `${ip.slice(0, 120)}|${email.trim().toLowerCase().slice(0, 254)}`
  }

  assertAllowed(email: string, ip: string): void {
    const key = this.key(email, ip)
    const entry = this.attempts.get(key)
    if (!entry) return
    if (entry.expiresAt <= Date.now()) {
      this.attempts.delete(key)
      return
    }
    if (entry.failed >= this.maxFailures) {
      throw new HttpException('Muitas tentativas de login. Tente novamente mais tarde.', 429)
    }
  }

  registerFailure(email: string, ip: string): void {
    this.prune()
    const key = this.key(email, ip)
    const current = this.attempts.get(key)
    if (!current || current.expiresAt <= Date.now()) {
      this.attempts.set(key, { failed: 1, expiresAt: Date.now() + this.windowMs })
    } else {
      current.failed += 1
    }
  }

  clear(email: string, ip: string): void {
    this.attempts.delete(this.key(email, ip))
  }

  private prune(): void {
    if (this.attempts.size < this.maxKeys) return
    const now = Date.now()
    for (const [key, entry] of this.attempts) {
      if (entry.expiresAt <= now) this.attempts.delete(key)
    }
    // Bound the process memory even if a hostile actor rotates identifiers.
    while (this.attempts.size >= this.maxKeys) {
      const oldest = this.attempts.keys().next().value
      if (!oldest) break
      this.attempts.delete(oldest)
    }
  }
}
