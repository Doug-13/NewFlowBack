import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { nextSequence, normalizeNumbering, renderCodePrefix, safeSegment, type NumberingSettings } from './numbering-rules'

@Injectable()
export class DocumentNumberingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Deve ser chamado DENTRO da transação que insere o documento. */
  async issue(tx: any, args: {
    accountId: string; processId: string; workflowId: string; requestedCode?: string;
    metadata?: Record<string, unknown>; area?: string; unit?: string;
  }): Promise<string> {
    const process = await tx.processes.findFirst({
      where: { id: args.processId, account_id: args.accountId, is_active: true },
      select: { id: true, code: true },
    })
    if (!process) throw new NotFoundException('Processo não encontrado ou inativo.')
    const workflow = await tx.workflows.findFirst({
      where: { id: args.workflowId, account_id: args.accountId, process_id: args.processId },
      select: { id: true },
    })
    if (!workflow) throw new BadRequestException('O workflow não pertence ao processo informado.')

    // Serialize os emissores do mesmo processo/conta. A trava só é liberada no COMMIT/ROLLBACK.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${args.accountId + ':' + args.processId}))`

    if (args.requestedCode?.trim()) {
      const code = safeSegment(args.requestedCode)
      if (!code || code.length > 60) throw new BadRequestException('Código documental inválido.')
      const conflict = await tx.documents.findFirst({ where: { account_id: args.accountId, code }, select: { id: true } })
      if (conflict) throw new ConflictException('Já existe documento com esse código.')
      return code
    }

    const links = await tx.configuration_environment_processes.findMany({
      where: { account_id: args.accountId, process_id: args.processId }, select: { environment_id: true },
    })
    const resourceCode = `PROC_${args.processId.replace(/-/g, '').toUpperCase()}`
    const resources = links.length ? await tx.configuration_resources.findMany({
      where: {
        account_id: args.accountId, kind: 'process-settings', code: resourceCode,
        is_active: true, environment_id: { in: links.map((item: any) => item.environment_id) },
      },
      select: { content: true, environment_id: true },
    }) : []
    if (resources.length > 1) throw new ConflictException('Há várias configurações de codificação para o mesmo processo.')
    const settings = resources[0]?.content as NumberingSettings | undefined
    const existing = await tx.documents.findMany({
      where: { account_id: args.accountId, process_id: args.processId }, select: { code: true },
    })
    let code: string
    if (!settings?.codingRule?.parts?.length) {
      // Compatibilidade com processos ainda não parametrizados: sequencial POR PROCESSO.
      const prefix = `${safeSegment(process.code || 'DOC')}-`
      code = nextSequence(existing.map((x: any) => x.code), prefix, '', 1, 6)
    } else {
      let parts = settings.codingRule.parts
      const seq = normalizeNumbering(settings)
      // Aplica período à chave do código; regras antigas sem ano/mês não reiniciam,
      // pois isso causaria colisões. A configuração continua preservada para evolução futura.
      if (seq.resetPeriod !== 'never' && !parts.some((part) => part.type === 'year')) {
        throw new BadRequestException('Para reinício anual ou mensal, inclua Ano na codificação; reinício mensal exige uma política de mês específica.')
      }
      if (seq.resetPeriod === 'monthly') {
        throw new BadRequestException('Reinício mensal ainda não suportado: mantenha Nunca ou Anual.')
      }
      const rendered = renderCodePrefix(parts, {
        processCode: process.code || 'DOC', area: args.area, unit: args.unit, metadata: args.metadata,
      })
      code = nextSequence(existing.map((x: any) => x.code), rendered.before, rendered.after, seq.startAt, seq.digits)
    }
    if (code.length > 60) throw new BadRequestException('Código gerado excede 60 caracteres.')
    // Outro processo pode ter utilizado a mesma regra de codificação.
    const globalConflict = await tx.documents.findFirst({ where: { account_id: args.accountId, code }, select: { id: true } })
    if (globalConflict) throw new ConflictException('O código gerado já existe em outro processo; revise a codificação.')
    return code
  }
}
