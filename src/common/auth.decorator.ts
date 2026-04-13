import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common'
import { PUBLIC_KEY } from './jwt-auth.guard'

/** Marca uma rota como pública — não exige token JWT */
export const Public = () => SetMetadata(PUBLIC_KEY, true)

/** Injeta o usuário logado extraído do token JWT */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    return request.user
  },
)

export type JwtUser = {
  id:        string
  email:     string
  role:      string
  accountId: string
  name:      string
}