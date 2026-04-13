import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { ProcessesService } from './processes.service'
import { Process } from './schema/process.schema'

describe('ProcessesService', () => {
  let service: ProcessesService

  const mockModel = {
    find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    findById: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessesService,
        { provide: getModelToken(Process.name), useValue: mockModel },
      ],
    }).compile()
    service = module.get<ProcessesService>(ProcessesService)
  })

  it('deve ser definido', () => expect(service).toBeDefined())
  it('findAll deve retornar array', async () => {
    expect(Array.isArray(await service.findAll('acc-1'))).toBe(true)
  })
})
