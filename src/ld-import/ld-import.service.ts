import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { DocumentsService } from '../documents/documents.service'
import { ResourceAccessService } from '../security/resource-access.service'
import { createHash } from 'node:crypto'

const ExcelJS = require('exceljs')
export type LdMapping = { column: string; metadataDefinitionId: string; required: boolean }
export type LdRow = { row: number; title: string; metadata: Record<string, string>; errors: string[] }
export function excelColumnIndex(letters: string): number {
  if (!/^[A-Z]{1,3}$/.test(letters)) throw new BadRequestException('Coluna de planilha inválida: ' + letters)
  let index = 0
  for (const char of letters) index = index * 26 + char.charCodeAt(0) - 64
  return index
}
export function inspectRow(row: number, cells: string[], mapping: LdMapping[], labels: Record<string, string>): LdRow | null {
  const metadata: Record<string, string> = {}
  const errors: string[] = []
  let found = false
  for (const item of mapping) {
    const value = String(cells[excelColumnIndex(item.column) - 1] ?? '').trim()
    if (value) found = true
    metadata[item.metadataDefinitionId] = value
    if (item.required && !value) errors.push(`Obrigatório: ${labels[item.metadataDefinitionId] ?? item.column}`)
  }
  if (!found) return null
  const title = String(metadata[mapping[0].metadataDefinitionId] || `Linha ${row}`).slice(0, 255)
  return { row, title, metadata, errors }
}

@Injectable()
export class LdImportService {
  constructor(private readonly prisma: PrismaService, private readonly documents: DocumentsService, private readonly access: ResourceAccessService) {}

  private async context(user: any, processId: string, workflowId: string) {
    await this.access.process(user, processId, 'create')
    const workflow = await this.prisma.workflows.findFirst({
      where: { id: workflowId, account_id: user.accountId, process_id: processId },
      select: { id: true, name: true },
    })
    if (!workflow) throw new NotFoundException('Workflow não encontrado neste processo.')
    const links = await this.prisma.configuration_environment_processes.findMany({
      where: { account_id: user.accountId, process_id: processId }, select: { environment_id: true },
    })
    const code = `PROC_${processId.replace(/-/g, '').toUpperCase()}`
    const resources = await this.prisma.configuration_resources.findMany({
      where: { account_id: user.accountId, kind: 'process-settings', code, is_active: true,
        environment_id: { in: links.map(l => l.environment_id) } }, select: { content: true },
    })
    if (resources.length !== 1) throw new BadRequestException('O processo deve ter exatamente uma configuração ativa.')
    const content = resources[0].content as any
    if (content?.documentBehavior?.type !== 'ld') throw new BadRequestException('Este processo não está configurado como LD.')
    const raw = content.documentBehavior.ld?.columns
    if (!Array.isArray(raw) || !raw.length) throw new BadRequestException('Configure as colunas da LD antes de importar.')
    const mapping: LdMapping[] = raw.map((m: any) => ({ column: String(m.column ?? '').trim().toUpperCase(), metadataDefinitionId: String(m.metadataDefinitionId ?? ''), required: m.required !== false }))
    const letters = mapping.map(m => m.column)
    if (new Set(letters).size !== letters.length) throw new BadRequestException('A LD contém colunas repetidas.')
    mapping.forEach(m => excelColumnIndex(m.column))
    const definitions = await this.prisma.metadata_definitions.findMany({
      where: { id: { in: mapping.map(m => m.metadataDefinitionId) }, OR: [{ account_id: user.accountId }, { account_id: null }], is_active: true },
      select: { id: true, label: true, name: true },
    })
    if (definitions.length !== new Set(mapping.map(m => m.metadataDefinitionId)).size) throw new BadRequestException('Há metadados inválidos ou inacessíveis no mapeamento.')
    const labels = Object.fromEntries(definitions.map(d => [d.id, d.label || d.name]))
    return { mapping, labels, hasHeader: content.documentBehavior.ld?.hasHeader !== false, workflow }
  }

  async preview(user: any, processId: string, workflowId: string, file: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('Selecione uma planilha XLSX.')
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('Planilha acima de 5 MB.')
    if (!/\.xlsx$/i.test(file.originalname)) throw new BadRequestException('Somente planilhas XLSX são aceitas.')
    const config = await this.context(user, processId, workflowId)
    const workbook = new ExcelJS.Workbook()
    try { await workbook.xlsx.load(file.buffer) } catch { throw new BadRequestException('Não foi possível ler a planilha XLSX.') }
    const worksheet = workbook.worksheets[0]
    if (!worksheet) throw new BadRequestException('A planilha não possui abas.')
    if (worksheet.rowCount > 502) throw new BadRequestException('Máximo de 500 linhas por importação.')
    const rows: LdRow[] = []
    const start = config.hasHeader ? 2 : 1
    for (let n = start; n <= worksheet.rowCount; n++) {
      const sheetRow = worksheet.getRow(n)
      const cells: string[] = []
      for (const item of config.mapping) {
        const idx = excelColumnIndex(item.column)
        const cell = sheetRow.getCell(idx)
        if (cell.type === ExcelJS.ValueType.Formula || cell.type === ExcelJS.ValueType.Hyperlink) throw new BadRequestException(`Fórmula ou link não permitido em ${item.column}${n}.`)
        cells[idx - 1] = cell.text ?? ''
      }
      const inspected = inspectRow(n, cells, config.mapping, config.labels)
      if (inspected) rows.push(inspected)
    }
    if (!rows.length) throw new BadRequestException('Nenhuma linha de documento encontrada.')
    return { fileHash: createHash('sha256').update(file.buffer).digest('hex'), total: rows.length,
      valid: rows.filter(r => !r.errors.length).length, invalid: rows.filter(r => r.errors.length).length,
      rows, workflowName: config.workflow.name }
  }

  async commit(user: any, processId: string, workflowId: string, file: Express.Multer.File, expectedHash: string) {
    if (!expectedHash || !/^[a-f0-9]{64}$/.test(expectedHash)) throw new BadRequestException('Valide a planilha antes de confirmar.')
    const result = await this.preview(user, processId, workflowId, file)
    if (expectedHash !== result.fileHash) throw new BadRequestException('A planilha mudou após a validação. Valide novamente.')
    if (result.invalid) throw new BadRequestException('Existem linhas inválidas. Corrija a planilha antes de importar.')
    const process = await this.prisma.processes.findFirst({ where: { id: processId, account_id: user.accountId }, select: { name: true } })
    if (!process) throw new NotFoundException('Processo não encontrado.')
    const output: { row: number; id?: string; code?: string; error?: string }[] = []
    for (const entry of result.rows) {
      // Cada documento é criado em uma transação independente, incluindo emissão de código.
      try {
        const doc = await this.documents.create({ processId, processName: process.name, workflowId, workflowName: result.workflowName,
          title: entry.title, initialMetadataValues: entry.metadata }, user)
        output.push({ row: entry.row, id: doc.id, code: doc.code })
      } catch (e: any) {
        output.push({ row: entry.row, error: String(e?.message ?? 'Falha ao criar documento') })
        // Interrompe para evitar continuar em caso de erro no servidor / permissões alteradas.
        break
      }
    }
    return { total: result.total, created: output.filter(x => x.id).length, errors: output.filter(x => x.error).length,
      partial: output.length !== result.total || output.some(x => x.error), results: output }
  }
}
