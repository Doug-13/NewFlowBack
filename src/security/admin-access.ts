import { ForbiddenException } from '@nestjs/common'

/** Regras de autorizacao avaliadas no backend, jamais no cliente. */
export function assertAdministrator(user: any): void {
  if (!user?.id || !user?.accountId || String(user.role ?? '').toLowerCase() !== 'admin') {
    throw new ForbiddenException('Acao reservada ao administrador da conta.')
  }
}
