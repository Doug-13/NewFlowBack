import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'
import * as bcrypt from 'bcryptjs'
import { AuthSessionsService } from './auth-sessions.service'
import { newSessionId } from './session-security'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly sessions: AuthSessionsService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.users.findUnique({
      where: { email: String(email).trim().toLowerCase() },
    })

    if (!user?.is_active) {
      throw new UnauthorizedException('E-mail ou senha inválidos.')
    }

    const valid = await bcrypt.compare(password, user.password_hash)

    if (!valid) {
      throw new UnauthorizedException('E-mail ou senha inválidos.')
    }

    const sessionId = newSessionId()
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      accountId: user.account_id,
      role: user.role,
      jti: sessionId,
    })
    await this.sessions.createSession(user.id, user.account_id, sessionId, accessToken)

    return {
      accessToken,
      tokenType: 'Bearer',
      user: this.publicUser(user),
      enabledModules: [
        'documents',
        'processes',
        'organization',
        'users',
        'dashboard',
      ],
    }
  }

  async me(userId: string) {
    const user = await this.prisma.users.findUniqueOrThrow({
      where: { id: userId },
    })

    return {
      accessToken: '',
      tokenType: 'Bearer',
      user: this.publicUser(user),
      enabledModules: [
        'documents',
        'processes',
        'organization',
        'users',
        'dashboard',
      ],
    }
  }

  async logout(userId: string, accountId: string, sessionId: string) {
    await this.sessions.revoke(userId, accountId, sessionId)
  }

  async logoutAll(userId: string, accountId: string) {
    return { revokedCount: await this.sessions.revokeAll(userId, accountId) }
  }

  async listSessions(userId: string, accountId: string, currentSessionId: string) {
    return this.sessions.list(userId, accountId, currentSessionId)
  }

  async revokeSession(userId: string, accountId: string, sessionId: string) {
    return { revoked: await this.sessions.revoke(userId, accountId, sessionId) }
  }

  private publicUser(user: any) {
    return {
      id: user.id,
      accountId: user.account_id,
      name: user.name,
      email: user.email,
      role: user.role,
      cpf: user.cpf,
      phone: user.phone,
      photoUrl: user.photo_url,
      department: user.department,
      jobTitle: user.job_title,
      position: user.position,
      isActive: user.is_active,
      notes: user.notes,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    }
  }
}
