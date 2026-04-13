import { Test, TestingModule } from '@nestjs/testing'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

describe('AuthController', () => {
  let controller: AuthController

  const mockService = {
    login:    jest.fn().mockResolvedValue({ access_token: 'jwt', user: { id: '1' } }),
    register: jest.fn().mockResolvedValue({ access_token: 'jwt', user: { id: '1' } }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers:   [{ provide: AuthService, useValue: mockService }],
    }).compile()
    controller = module.get<AuthController>(AuthController)
  })

  it('deve ser definido', () => expect(controller).toBeDefined())
  it('login deve retornar token', async () => {
    const r = await controller.login({ email: 'a@a.com', password: '123456' })
    expect(r).toHaveProperty('access_token')
  })
})
