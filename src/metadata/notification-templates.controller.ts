import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PrismaService } from '../prisma/prisma.service'

@UseGuards(JwtAuthGuard)
@Controller('notificationTemplates')
export class NotificationTemplatesController {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(user: any) {
    if (user?.role !== 'admin') {
      throw new ForbiddenException('Somente administradores podem alterar modelos de notificacao.')
    }
  }

  private dto(item: any) {
    return {
      id: item.id,
      accountId: item.account_id,
      name: item.name,
      code: item.code,
      description: item.description ?? '',
      channel: item.channel,
      subject: item.subject ?? '',
      body: item.body,
      isActive: item.is_active,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }
  }

  private payload(input: any) {
    const name = String(input?.name ?? '').trim()
    const code = String(input?.code ?? '').trim()
    const channel = String(input?.channel ?? '').trim()
    const body = String(input?.body ?? '').trim()
    if (!name || !code || !body || name.length > 150 || code.length > 100) {
      throw new BadRequestException('Nome, codigo e corpo sao obrigatorios.')
    }
    if (!['email', 'system', 'whatsapp'].includes(channel)) {
      throw new BadRequestException('Canal de notificacao invalido.')
    }
    return {
      name,
      code,
      channel,
      body,
      description: String(input?.description ?? '').slice(0, 2000),
      subject: channel === 'email' ? String(input?.subject ?? '').trim() : '',
      is_active: input?.isActive !== false,
    }
  }

  @Get()
  async list(@CurrentUser() user: any) {
    const rows = await this.prisma.notification_templates.findMany({
      where: { account_id: user.accountId },
      orderBy: { name: 'asc' },
    })
    return rows.map((row) => this.dto(row))
  }

  @Get(':id')
  async get(@CurrentUser() user: any, @Param('id') id: string) {
    const row = await this.prisma.notification_templates.findFirst({
      where: { id, account_id: user.accountId },
    })
    if (!row) throw new NotFoundException('Modelo de notificacao nao encontrado.')
    return this.dto(row)
  }

  @Post()
  async create(@CurrentUser() user: any, @Body() body: any) {
    this.assertAdmin(user)
    const data = this.payload(body)
    const existing = await this.prisma.notification_templates.findFirst({
      where: { account_id: user.accountId, code: data.code },
    })
    if (existing) throw new ConflictException('Ja existe um modelo com este codigo.')
    const row = await this.prisma.notification_templates.create({
      data: { ...data, account_id: user.accountId },
    })
    return this.dto(row)
  }

  @Put(':id')
  async update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(user)
    const current = await this.prisma.notification_templates.findFirst({
      where: { id, account_id: user.accountId },
    })
    if (!current) throw new NotFoundException('Modelo de notificacao nao encontrado.')
    const data = this.payload(body)
    const duplicate = await this.prisma.notification_templates.findFirst({
      where: { account_id: user.accountId, code: data.code, id: { not: id } },
    })
    if (duplicate) throw new ConflictException('Ja existe um modelo com este codigo.')
    const row = await this.prisma.notification_templates.update({
      where: { id }, data: { ...data, updated_at: new Date() },
    })
    return this.dto(row)
  }

  @Delete(':id')
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    this.assertAdmin(user)
    const current = await this.prisma.notification_templates.findFirst({
      where: { id, account_id: user.accountId },
    })
    if (!current) throw new NotFoundException('Modelo de notificacao nao encontrado.')
    await this.prisma.notification_templates.delete({ where: { id } })
    return { success: true }
  }
}
