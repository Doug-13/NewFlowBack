import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'
import { readBearerJwt } from './auth-security'
import { AuthSessionsService } from './auth-sessions.service'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly sessions: AuthSessionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const token = readBearerJwt(request.headers.authorization)
    if (!token) throw new UnauthorizedException('Token nao informado ou malformado.')

    try {
      const payload = await this.jwtService.verifyAsync(token)
      if (!payload || typeof payload.sub !== 'string' || !payload.sub.trim()) {
        throw new UnauthorizedException('Token sem identidade valida.')
      }

      const user = await this.prisma.users.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          account_id: true,
          name: true,
          email: true,
          role: true,
          is_active: true,
        },
      })

      if (!user?.is_active) {
        throw new UnauthorizedException('Usuário inválido ou inativo.')
      }
      await this.sessions.assertActive(user.id, user.account_id, payload.jti, token)

      request.user = {
        id: user.id,
        accountId: user.account_id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.is_active,
        sessionId: payload.jti,
      }

      return true
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.')
    }
  }
}
