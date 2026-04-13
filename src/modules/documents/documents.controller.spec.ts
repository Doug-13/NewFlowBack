import { Test, TestingModule } from '@nestjs/testing'
import { DocumentsController } from './documents.controller'
import { DocumentsService } from './documents.service'

const mockUser = { id: 'u1', email: 'a@a.com', role: 'Admin', accountId: 'acc-1', name: 'Admin' }

describe('DocumentsController', () => {
  let controller: DocumentsController

  const mockService = {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 'doc-1', title: 'Test' }),
    create:  jest.fn().mockResolvedValue({ id: 'doc-1', title: 'Test' }),
    cancel:  jest.fn().mockResolvedValue({ success: true }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [{ provide: DocumentsService, useValue: mockService }],
    }).compile()
    controller = module.get<DocumentsController>(DocumentsController)
  })

  it('deve ser definido', () => expect(controller).toBeDefined())

  it('findAll deve retornar array', async () => {
    const result = await controller.findAll(mockUser, {})
    expect(Array.isArray(result)).toBe(true)
  })

  it('create deve retornar documento criado', async () => {
    const dto = { title: 'Contrato', accountId: 'acc-1', processId: 'proc-1', workflowId: 'wf-1' } as any
    const result = await controller.create(dto, mockUser)
    expect(result).toHaveProperty('id')
  })
})