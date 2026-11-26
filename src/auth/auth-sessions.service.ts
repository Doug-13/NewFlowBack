import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { isValidSessionId, SESSION_DURATION_MS, tokenFingerprint } from './session-security'

@Injectable()
export class AuthSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(userId: string, accountId: string, sessionId: string, accessToken: string) {
    await this.prisma.auth_sessions.create({
      data: {
        id: sessionId,
        user_id: userId,
        account_id: accountId,
        token_hash: tokenFingerprint(accessToken),
        expires_at: new Date(Date.now() + SESSION_DURATION_MS),
      },
    })
  }

  async assertActive(userId: string, accountId: string, sessionId: unknown, accessToken: string): Promise<void> {
    if (!isValidSessionId(sessionId)) {
      throw new UnauthorizedException('Sessao invalida ou encerrada.')
    }
    const active = await this.prisma.auth_sessions.findFirst({
      where: {
        id: sessionId,
        user_id: userId,
        account_id: accountId,
        token_hash: tokenFingerprint(accessToken),
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
      select: { id: true },
    })
    if (!active) throw new UnauthorizedException('Sessao invalida ou encerrada.')
  }

  async revoke(userId: string, accountId: string, sessionId: string): Promise<boolean> {
    if (!isValidSessionId(sessionId)) return false
    const updated = await this.prisma.auth_sessions.updateMany({
      where: { id: sessionId, user_id: userId, account_id: accountId, revoked_at: null },
      data: { revoked_at: new Date() },
    })
    return updated.count > 0
  }

  async revokeAll(userId: string, accountId: string): Promise<number> {
    const updated = await this.prisma.auth_sessions.updateMany({
      where: { user_id: userId, account_id: accountId, revoked_at: null },
      data: { revoked_at: new Date() },
    })
    return updated.count
  }

  async list(userId: string, accountId: string, currentSessionId: string) {
    const entries = await this.prisma.auth_sessions.findMany({
      where: { user_id: userId, account_id: accountId, revoked_at: null, expires_at: { gt: new Date() } },
      select: { id: true, created_at: true, expires_at: true },
      orderBy: { created_at: 'desc' },
      take: 100,
    })
    return entries.map((item) => ({
      id: item.id,
      createdAt: item.created_at,
      expiresAt: item.expires_at,
      current: item.id === currentSessionId,
    }))
  }
}
