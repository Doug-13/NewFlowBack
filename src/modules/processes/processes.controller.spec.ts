import { Test, TestingModule } from '@nestjs/testing'
import { ProcessesController } from './processes.controller'
import { ProcessesService } from './processes.service'

const mockUser = { id: 'u1', email: 'a@a.com', role: 'Admin', accountId: 'acc-1', name: 'Admin' }

describe('ProcessesController', () => {
  let controller: ProcessesController

  const mockSvc = {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 'p1', name: 'Contratos' }),
    create:  jest.fn().mockResolvedValue({ id: 'p1' }),
    update:  jest.fn().mockResolvedValue({ id: 'p1' }),
    remove:  jest.fn().mockResolvedValue({ success: true }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcessesController],
      providers:   [{ provide: ProcessesService, useValue: mockSvc }],
    }).compile()
    controller = module.get<ProcessesController>(ProcessesController)
  })

  it('deve ser definido', () => expect(controller).toBeDefined())

  it('findAll deve retornar array', async () => {
    expect(Array.isArray(await controller.findAll(mockUser, {}))).toBe(true)
  })
})