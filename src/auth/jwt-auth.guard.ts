import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const authorization = String(request.headers.authorization || '')

    if (!authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token não informado.')
    }

    const token = authorization.slice(7)

    try {
      const payload = await this.jwtService.verifyAsync(token)

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

      request.user = {
        id: user.id,
        accountId: user.account_id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.is_active,
      }

      return true
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.')
    }
  }
}
