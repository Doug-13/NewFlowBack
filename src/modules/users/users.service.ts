import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import * as bcrypt from 'bcrypt'
import { User, UserDocument } from '../auth/schema/user.schema'
import { UserMembership, UserMembershipDocument } from './schema/user-membership.schema'
import { CreateUserDto, UpdateUserDto } from './dto/user.dto'

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(UserMembership.name)
    private readonly membershipModel: Model<UserMembershipDocument>,
  ) {}

  async findAll(accountId?: string) {
    const query = accountId ? { accountId } : {}
    return this.userModel.find(query).select('-password').lean()
  }

  async findOne(id: string) {
    const user = await this.userModel.findById(id).select('-password').lean()
    if (!user) throw new NotFoundException(`Usuário ${id} não encontrado`)
    return user
  }

  async create(dto: CreateUserDto) {
    // Verifica email duplicado com mensagem amigável
    const existing = await this.userModel.findOne({ email: dto.email })
    if (existing) throw new BadRequestException(`E-mail "${dto.email}" já está cadastrado`)

    const rawPassword = dto.password?.trim() || 'changeme'
    const hash        = await bcrypt.hash(rawPassword, 10)
    const { password, ...rest } = dto as any

    try {
      return await this.userModel.create({
        ...rest,
        password: hash,
        role:     dto.role     ?? 'user',
        isActive: dto.isActive ?? true,
      })
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException(`E-mail "${dto.email}" já está cadastrado`)
      }
      throw err
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    const updateData: Record<string, any> = { ...dto }

    if (dto.password?.trim()) {
      updateData.password = await bcrypt.hash(dto.password.trim(), 10)
    } else {
      delete updateData.password
    }

    try {
      const user = await this.userModel
        .findByIdAndUpdate(id, updateData, { new: true })
        .select('-password')
      if (!user) throw new NotFoundException(`Usuário ${id} não encontrado`)
      return user
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('E-mail já está em uso por outro usuário')
      }
      throw err
    }
  }

  async remove(id: string) {
    await this.userModel.findByIdAndDelete(id)
    return { success: true }
  }

  // ── Memberships ─────────────────────────────────────────────────────────────

  async findMemberships(filters: { userId?: string; accountId?: string; processId?: string }) {
    const query: Record<string, any> = {}
    if (filters.userId)    query.userId    = filters.userId
    if (filters.accountId) query.accountId = filters.accountId
    if (filters.processId) query.processId = filters.processId
    return this.membershipModel.find(query).lean()
  }

  async createMembership(data: { userId: string; accountId: string; processId: string; role?: string }) {
    return this.membershipModel.create({ ...data, isActive: true })
  }
}