import {
  Injectable, CanActivate, ExecutionContext, UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Reflector } from '@nestjs/core'

export const PUBLIC_KEY = 'isPublic'

/**
 * Guard JWT global.
 * - Rotas marcadas com @Public() passam sem token.
 * - Demais rotas exigem Bearer token válido.
 * - O payload do token é injetado em req.user.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Verifica se a rota é pública
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest()
    const token   = this.extractToken(request)

    if (!token) throw new UnauthorizedException('Token não fornecido')

    try {
      const payload  = this.jwtService.verify(token)
      request.user   = {
        id:        payload.sub,
        email:     payload.email,
        role:      payload.role,
        accountId: payload.accountId,
        name:      payload.name,
      }
      return true
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado')
    }
  }

  private extractToken(request: any): string | null {
    const auth = request.headers?.authorization ?? ''
    if (auth.startsWith('Bearer ')) return auth.slice(7)
    return null
  }
}