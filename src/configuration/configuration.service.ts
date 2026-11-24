import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

const KINDS = new Set(['scripts', 'visualization', 'document-policy'])
const CODE = /^[A-Z][A-Z0-9_-]{1,59}$/

@Injectable()
export class ConfigurationService {
  constructor(private readonly prisma: PrismaService) {}

  private account(user: any) {
    const account = String(user?.accountId ?? '')
    if (!account) throw new ForbiddenException('Conta não identificada.')
    return account
  }
  private admin(user: any) {
    this.account(user)
    if (String(user?.role ?? '').toLowerCase() !== 'admin') throw new ForbiddenException('Recurso exclusivo do administrador.')
  }
  private async env(user: any, id: string) {
    const record = await this.prisma.configuration_environments.findFirst({ where: { id, account_id: this.account(user) } })
    if (!record) throw new NotFoundException('Ambiente não encontrado.')
    return record
  }
  private kind(kind: string) { if (!KINDS.has(kind)) throw new BadRequestException('Tipo de configuração inválido.') }
  private named(body: any) {
    const name = String(body?.name ?? '').trim()
    const code = String(body?.code ?? '').trim().toUpperCase()
    if (!name || name.length > 180 || !CODE.test(code)) throw new BadRequestException('Informe nome e código válido (2 a 60 caracteres).')
    return { name, code }
  }
  private dtoEnv(r: any) { return { id: r.id, name: r.name, code: r.code, description: r.description, isActive: r.is_active, createdAt: r.created_at } }
  private dtoResource(r: any) { return { id: r.id, kind: r.kind, name: r.name, code: r.code, content: r.content, isActive: r.is_active, updatedAt: r.updated_at } }

  async listEnvironments(user: any) {
    const items = await this.prisma.configuration_environments.findMany({ where: { account_id: this.account(user) }, orderBy: { name: 'asc' } })
    return items.map((v) => this.dtoEnv(v))
  }
  async createEnvironment(user: any, body: any) {
    this.admin(user)
    const fields = this.named(body)
    const exists = await this.prisma.configuration_environments.findFirst({ where: { account_id: this.account(user), code: fields.code } })
    if (exists) throw new ConflictException('Já existe um ambiente com este código.')
    const r = await this.prisma.configuration_environments.create({ data: { ...fields, account_id: this.account(user), description: String(body?.description ?? '').slice(0, 1000), is_active: body?.isActive !== false } })
    return this.dtoEnv(r)
  }
  async updateEnvironment(user: any, id: string, body: any) {
    this.admin(user)
    await this.env(user, id)
    const fields = this.named(body)
    const r = await this.prisma.configuration_environments.update({ where: { id }, data: { ...fields, description: String(body?.description ?? '').slice(0, 1000), is_active: body?.isActive !== false, updated_at: new Date() } })
    return this.dtoEnv(r)
  }
  async listProcesses(user: any, id: string) {
    await this.env(user, id)
    const items = await this.prisma.configuration_environment_processes.findMany({ where: { environment_id: id } })
    return items.map((v) => v.process_id)
  }
  async attachProcess(user: any, id: string, body: any) {
    this.admin(user)
    await this.env(user, id)
    const processId = String(body?.processId ?? '')
    const process = await this.prisma.processes.findFirst({ where: { id: processId, account_id: this.account(user) } })
    if (!process) throw new NotFoundException('Processo não encontrado nesta conta.')
    await this.prisma.configuration_environment_processes.upsert({ where: { account_id_process_id: { account_id: this.account(user), process_id: processId } }, create: { account_id: this.account(user), environment_id: id, process_id: processId }, update: { environment_id: id } })
    return { processId, environmentId: id }
  }
  async detachProcess(user: any, id: string, processId: string) {
    this.admin(user)
    await this.env(user, id)
    await this.prisma.configuration_environment_processes.deleteMany({ where: { account_id: this.account(user), environment_id: id, process_id: processId } })
    return { success: true }
  }
  async listResources(user: any, id: string, kind: string) {
    this.kind(kind)
    await this.env(user, id)
    return (await this.prisma.configuration_resources.findMany({ where: { environment_id: id, kind }, orderBy: { name: 'asc' } })).map((x) => this.dtoResource(x))
  }
  private validateResource(kind: string, body: any) {
    this.kind(kind)
    const name = String(body?.name ?? '').trim()
    const code = String(body?.code ?? '').trim().toUpperCase()
    if (!name || name.length > 180 || !CODE.test(code)) throw new BadRequestException('Nome e identificador são obrigatórios.')
    const content = body?.content
    if (!content || typeof content !== 'object' || Array.isArray(content) || JSON.stringify(content).length > 100000) throw new BadRequestException('Configuração inválida ou muito extensa.')
    if (kind === 'scripts' && !['javascript', 'python'].includes(String(content.language))) throw new BadRequestException('Linguagem inválida.')
    // Scripts são apenas armazenados. Nenhum código fornecido pelo usuário é executado neste serviço.
    return { name, code, content, is_active: body?.isActive !== false }
  }
  async createResource(user: any, id: string, kind: string, body: any) {
    this.admin(user); await this.env(user, id)
    const data = this.validateResource(kind, body)
    const exists = await this.prisma.configuration_resources.findFirst({ where: { environment_id: id, kind, code: data.code } })
    if (exists) throw new ConflictException('Identificador já utilizado neste ambiente.')
    return this.dtoResource(await this.prisma.configuration_resources.create({ data: { ...data, kind, environment_id: id, account_id: this.account(user) } }))
  }
  async updateResource(user: any, id: string, kind: string, resourceId: string, body: any) {
    this.admin(user); await this.env(user, id); this.kind(kind)
    const before = await this.prisma.configuration_resources.findFirst({ where: { id: resourceId, environment_id: id, kind } })
    if (!before) throw new NotFoundException('Configuração não encontrada.')
    const data = this.validateResource(kind, body)
    return this.dtoResource(await this.prisma.configuration_resources.update({ where: { id: resourceId }, data: { ...data, updated_at: new Date() } }))
  }
}
