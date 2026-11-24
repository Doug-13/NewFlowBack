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
@Controller('metadata/sets')
export class MetadataSetsController {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(user: any) {
    if (user?.role !== 'admin') {
      throw new ForbiddenException('Somente administradores podem alterar conjuntos de metadados.')
    }
  }

  private dto(item: any) {
    return {
      id: item.id,
      name: item.name,
      code: item.code,
      description: item.description ?? '',
      isActive: item.is_active,
      orderIndex: item.order_index,
    }
  }

  private payload(body: any) {
    const name = String(body?.name ?? '').trim()
    const code = String(body?.code ?? '').trim()
    if (!name || !code || name.length > 150 || code.length > 100) {
      throw new BadRequestException('Nome e codigo sao obrigatorios e devem respeitar os limites de tamanho.')
    }
    return {
      name,
      code,
      description: String(body?.description ?? '').slice(0, 2000),
      is_active: body?.isActive !== false,
      order_index: Number.isInteger(body?.orderIndex) ? body.orderIndex : 0,
    }
  }

  @Get()
  async list(@CurrentUser() user: any) {
    const rows = await this.prisma.metadata_sets.findMany({
      where: { OR: [{ account_id: user.accountId }, { account_id: null }] },
      orderBy: [{ order_index: 'asc' }, { name: 'asc' }],
    })
    return rows.map((row) => this.dto(row))
  }

  @Post()
  async create(@CurrentUser() user: any, @Body() body: any) {
    this.assertAdmin(user)
    const data = this.payload(body)
    const exists = await this.prisma.metadata_sets.findFirst({
      where: { account_id: user.accountId, code: data.code },
    })
    if (exists) throw new ConflictException('Ja existe um conjunto com este codigo.')
    const row = await this.prisma.metadata_sets.create({
      data: { ...data, account_id: user.accountId },
    })
    return this.dto(row)
  }

  @Put(':id')
  async update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(user)
    const current = await this.prisma.metadata_sets.findFirst({
      where: { id, account_id: user.accountId },
    })
    if (!current) throw new NotFoundException('Conjunto nao encontrado.')
    const data = this.payload(body)
    const duplicate = await this.prisma.metadata_sets.findFirst({
      where: { account_id: user.accountId, code: data.code, id: { not: id } },
    })
    if (duplicate) throw new ConflictException('Ja existe um conjunto com este codigo.')
    const row = await this.prisma.metadata_sets.update({
      where: { id },
      data: { ...data, updated_at: new Date() },
    })
    return this.dto(row)
  }

  @Delete(':id')
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    this.assertAdmin(user)
    const current = await this.prisma.metadata_sets.findFirst({
      where: { id, account_id: user.accountId },
    })
    if (!current) throw new NotFoundException('Conjunto nao encontrado.')
    const linked = await this.prisma.metadata_definitions.count({
      where: { metadata_set_id: id },
    })
    if (linked > 0) {
      throw new ConflictException('Nao e possivel excluir um conjunto com metadados vinculados.')
    }
    await this.prisma.metadata_sets.delete({ where: { id } })
    return { success: true }
  }
}
