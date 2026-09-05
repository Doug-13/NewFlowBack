import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'
import * as bcrypt from 'bcryptjs'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.users.findUnique({
      where: { email: String(email).trim().toLowerCase() },
    })

    if (!user?.is_active) {
      throw new UnauthorizedException('E-mail ou senha inválidos.')
    }

    const valid = await bcrypt.compare(password, user.password_hash)

    if (!valid) {
      throw new UnauthorizedException('E-mail ou senha inválidos.')
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      accountId: user.account_id,
      role: user.role,
    })

    return {
      accessToken,
      tokenType: 'Bearer',
      user: this.publicUser(user),
      enabledModules: [
        'documents',
        'processes',
        'organization',
        'users',
        'dashboard',
      ],
    }
  }

  async me(userId: string) {
    const user = await this.prisma.users.findUniqueOrThrow({
      where: { id: userId },
    })

    return {
      accessToken: '',
      tokenType: 'Bearer',
      user: this.publicUser(user),
      enabledModules: [
        'documents',
        'processes',
        'organization',
        'users',
        'dashboard',
      ],
    }
  }

  private publicUser(user: any) {
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
}
