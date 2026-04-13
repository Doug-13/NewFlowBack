import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { JwtService } from '@nestjs/jwt'
import { UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service'
import { User } from './schema/user.schema'

describe('AuthService', () => {
  let service: AuthService

  const mockUserModel = {
    findOne: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) }),
    create:  jest.fn(),
  }
  const mockJwt = { sign: jest.fn().mockReturnValue('jwt-token') }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: JwtService,               useValue: mockJwt       },
      ],
    }).compile()
    service = module.get<AuthService>(AuthService)
  })

  it('deve ser definido', () => expect(service).toBeDefined())

  it('login com credenciais inválidas deve lançar UnauthorizedException', async () => {
    await expect(service.login({ email: 'x@x.com', password: '123' }))
      .rejects.toThrow(UnauthorizedException)
  })
})
