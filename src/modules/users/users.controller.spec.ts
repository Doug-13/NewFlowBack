import { Test, TestingModule } from '@nestjs/testing'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'

const mockUser = { id: 'u1', email: 'a@a.com', role: 'Admin', accountId: 'acc-1', name: 'Admin' }

describe('UsersController', () => {
  let controller: UsersController

  const mockService = {
    findAll:          jest.fn().mockResolvedValue([]),
    findOne:          jest.fn().mockResolvedValue({ id: 'u1', name: 'Admin' }),
    create:           jest.fn().mockResolvedValue({ _id: 'u1', name: 'Admin' }),
    update:           jest.fn().mockResolvedValue({ _id: 'u1', name: 'Admin' }),
    remove:           jest.fn().mockResolvedValue({ success: true }),
    findMemberships:  jest.fn().mockResolvedValue([]),
    createMembership: jest.fn().mockResolvedValue({ id: 'm1' }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers:   [{ provide: UsersService, useValue: mockService }],
    }).compile()
    controller = module.get<UsersController>(UsersController)
  })

  it('deve ser definido', () => expect(controller).toBeDefined())

  it('findAll deve retornar array', async () => {
    const r = await controller.findAll(mockUser)
    expect(Array.isArray(r)).toBe(true)
  })
})