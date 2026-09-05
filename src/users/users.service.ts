import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import * as bcrypt from 'bcryptjs'

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(user: any) {
    return {
      id: user.id,
      accountId: user.account_id,
      name: user.name,
      email: user.email,
      role: user.role,
      cpf: user.cpf,
      phone: user.phone,
      photoUrl: user.photo_url,
      department: user.department,
      jobTitle: user.job_title,
      position: user.position,
      isActive: user.is_active,
      notes: user.notes,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    }
  }

  async list(accountId: string) {
    const users = await this.prisma.users.findMany({
      where: { account_id: accountId },
      orderBy: { name: 'asc' },
    })
    return users.map((user) => this.toDto(user))
  }

  async create(data: any, fallbackAccountId: string) {
    const email = String(data.email || '').trim().toLowerCase()

    if (await this.prisma.users.findUnique({ where: { email } })) {
      throw new BadRequestException('Já existe um usuário com este e-mail.')
    }

    const passwordHash = await bcrypt.hash(data.password || 'Mudar@123', 12)

    const user = await this.prisma.users.create({
      data: {
        account_id: data.accountId || fallbackAccountId,
        name: data.name,
        email,
        password_hash: passwordHash,
        role: data.role || 'user',
        cpf: data.cpf,
        phone: data.phone,
        photo_url: data.photoUrl,
        department: data.department,
        job_title: data.jobTitle,
        position: data.position,
        is_active: data.isActive ?? true,
        notes: data.notes,
      },
    })

    return this.toDto(user)
  }

  async update(id: string, data: any) {
    const exists = await this.prisma.users.findUnique({ where: { id } })
    if (!exists) throw new NotFoundException('Usuário não encontrado.')

    const payload: any = {
      name: data.name,
      email: data.email ? String(data.email).trim().toLowerCase() : undefined,
      role: data.role,
      cpf: data.cpf,
      phone: data.phone,
      photo_url: data.photoUrl,
      department: data.department,
      job_title: data.jobTitle,
      position: data.position,
      is_active: data.isActive,
      notes: data.notes,
      updated_at: new Date(),
    }

    if (data.password) {
      payload.password_hash = await bcrypt.hash(data.password, 12)
    }

    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key])

    const user = await this.prisma.users.update({
      where: { id },
      data: payload,
    })

    return this.toDto(user)
  }

  async remove(id: string) {
    await this.prisma.users.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Usuário não encontrado.')
    })
    return { success: true }
  }
}
