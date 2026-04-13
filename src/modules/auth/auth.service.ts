import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import * as bcrypt from 'bcrypt'
import { User, UserDocument } from './schema/user.schema'
import { LoginDto, RegisterDto } from './dto/auth.dto'

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
  ) {}

  private toResponse(user: UserDocument, token: string) {
    return {
      accessToken:    token,
      tokenType:      'Bearer',
      enabledModules: ['documents', 'workflow', 'metadata', 'users', 'organization', 'notification_templates'],
      user: {
        id:        String(user._id),
        name:      user.name,
        email:     user.email,
        role:      user.role,
        accountId: user.accountId,
      },
    }
  }

  async login(dto: LoginDto) {
    const user = await this.userModel.findOne({ email: dto.email }).select('+password')
    if (!user) throw new UnauthorizedException('Credenciais inválidas')
    const valid = await bcrypt.compare(dto.password, user.password)
    if (!valid) throw new UnauthorizedException('Credenciais inválidas')
    const payload = { sub: String(user._id), email: user.email, role: user.role, accountId: user.accountId, name: user.name }
    return this.toResponse(user, this.jwtService.sign(payload))
  }

  async register(dto: RegisterDto) {
    const existing = await this.userModel.findOne({ email: dto.email })
    if (existing) throw new UnauthorizedException('Email já cadastrado')
    const hash = await bcrypt.hash(dto.password, 10)
    const user  = await this.userModel.create({
      accountId: dto.accountId,
      name:      dto.name,
      email:     dto.email,
      password:  hash,
      role:      dto.role ?? 'user',  // ← preserva o role enviado
    })
    const payload = { sub: String(user._id), email: user.email, role: user.role, accountId: user.accountId, name: user.name }
    return this.toResponse(user, this.jwtService.sign(payload))
  }

  async getMe(userId: string) {
    const user = await this.userModel.findById(userId)
    if (!user) throw new UnauthorizedException('Usuário não encontrado')
    const payload = { sub: String(user._id), email: user.email, role: user.role, accountId: user.accountId, name: user.name }
    return this.toResponse(user, this.jwtService.sign(payload))
  }
}