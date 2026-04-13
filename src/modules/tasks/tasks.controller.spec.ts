import { Test, TestingModule } from '@nestjs/testing'
import { TasksController } from './tasks.controller'
import { TasksService } from './tasks.service'

const mockUser = { id: 'u1', email: 'a@a.com', role: 'Admin', accountId: 'acc-1', name: 'Admin' }

describe('TasksController', () => {
  let controller: TasksController

  const mockService = {
    findMyTasks: jest.fn().mockResolvedValue([]),
    execute:     jest.fn().mockResolvedValue({ success: true, status: 'in_progress' }),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers:   [{ provide: TasksService, useValue: mockService }],
    }).compile()
    controller = module.get<TasksController>(TasksController)
  })

  it('deve ser definido', () => expect(controller).toBeDefined())

  it('findMy deve retornar tarefas do usuário', async () => {
    const result = await controller.findMy(mockUser)
    expect(Array.isArray(result)).toBe(true)
  })

  it('execute deve retornar sucesso', async () => {
    const result = await controller.execute('task-1', { action: 'approve' } as any, mockUser)
    expect(result).toHaveProperty('success')
  })
})